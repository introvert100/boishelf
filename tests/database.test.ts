import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const reader = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  book = "33333333-3333-4333-8333-333333333333";
test("PostgreSQL migration, access policies and atomic payment transitions", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin; create schema auth; create schema storage; grant usage on schema public,auth,storage to anon,authenticated,service_role,supabase_auth_admin; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(bucket_id text,name text);`,
  );
  await db.exec("grant select on storage.objects to service_role;");
  for (const path of readdirSync("supabase/migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${path}`, "utf8"));
  await db.query(
    "insert into auth.users(id,email) values($1,'reader@gmail.com'),($2,'other@gmail.com')",
    [reader, other],
  );
  await db.query(
    "insert into books(id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,category,price_paisa,pages,published) values($1,'real-book','বই','Real book','লেখক','Author','বিবরণ','Description','fiction',24900,100,true)",
    [book],
  );
  await db.query(
    "insert into book_formats(book_id,format,storage_path,original_name,size_bytes) values($1,'pdf','private/sample.pdf','book.pdf',100)",
    [book],
  );
  async function asRole<T>(
    role: string,
    user: string | null,
    work: () => Promise<T>,
  ): Promise<T> {
    await db.exec(`begin;set local role ${role};`);
    if (user)
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
    try {
      const result = await work();
      await db.exec("rollback");
      return result;
    } catch (e) {
      await db.exec("rollback");
      throw e;
    }
  }
  let order: {
    id: string;
    tran_id: string;
    amount_paisa: number;
    reused: boolean;
  };
  await t.test("all ten public tables have RLS", async () => {
    const { rows } = await db.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(
      "select relname,relrowsecurity from pg_class join pg_namespace on pg_namespace.oid=relnamespace where nspname='public' and relkind='r'",
    );
    assert.equal(rows.length, 10);
    assert.ok(rows.every((r) => r.relrowsecurity));
  });
  await t.test("free-tier ebook bucket accepts 50 MB files and remains private", async () => {
    const { rows } = await db.query<{ file_size_limit: number; public: boolean }>(
      "select file_size_limit,public from storage.buckets where id='ebooks'",
    );
    assert.equal(Number(rows[0].file_size_limit), 50 * 1024 * 1024);
    assert.equal(rows[0].public, false);
    const { rows: constraints } = await db.query<{ definition: string }>(
      "select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.book_formats'::regclass and conname='book_formats_size_bytes_check'",
    );
    assert.match(constraints[0].definition, /52428800/);
  });
  await t.test(
    "anonymous readers see published books but cannot write or read file paths",
    async () => {
      await asRole("anon", null, async () => {
        assert.equal((await db.query("select * from books")).rows.length, 1);
      });
      await assert.rejects(
        asRole("anon", null, () =>
          db.query("select storage_path from book_formats"),
        ),
      );
      await assert.rejects(
        asRole("anon", null, () =>
          db.query("update books set price_paisa=1000"),
        ),
      );
      await assert.rejects(
        asRole("anon", null, () => db.query("select * from orders")),
      );
    },
  );
  await t.test(
    "customers cannot call privileged payment functions or edit their profile",
    async () => {
      await assert.rejects(
        asRole("authenticated", reader, () =>
          db.query("select create_order($1,$2,'sandbox')", [reader, book]),
        ),
      );
      await assert.rejects(
        asRole("authenticated", reader, () =>
          db.query("update profiles set email='attacker@gmail.com'"),
        ),
      );
      await assert.rejects(
        asRole("authenticated", reader, () =>
          db.query("select * from payment_attempts"),
        ),
      );
    },
  );
  await t.test(
    "order price is taken from catalogue; concurrent retries reuse pending order",
    async () => {
      order = (
        await db.query<{ v: typeof order }>(
          "select create_order($1,$2,'sandbox') as v",
          [reader, book],
        )
      ).rows[0].v;
      assert.equal(order.amount_paisa, 24900);
      assert.equal(order.reused, false);
      const retry = (
        await db.query<{ v: typeof order }>(
          "select create_order($1,$2,'sandbox') as v",
          [reader, book],
        )
      ).rows[0].v;
      assert.equal(retry.id, order.id);
      assert.equal(retry.reused, true);
    },
  );
  await t.test("customer records are isolated by RLS", async () => {
    assert.equal(
      await asRole(
        "authenticated",
        reader,
        async () => (await db.query("select * from orders")).rows.length,
      ),
      1,
    );
    assert.equal(
      await asRole(
        "authenticated",
        other,
        async () => (await db.query("select * from orders")).rows.length,
      ),
      0,
    );
    assert.equal(
      await asRole(
        "authenticated",
        other,
        async () => (await db.query("select * from profiles")).rows.length,
      ),
      1,
    );
  });
  await t.test("failed and cancelled attempts grant no access", async () => {
    await db.query("select mark_order_unsuccessful($1,'cancelled')", [
      order.id,
    ]);
    assert.equal((await db.query("select * from entitlements")).rows.length, 0);
  });
  await t.test(
    "tampered amount and sandbox/live mismatches roll back",
    async () => {
      await assert.rejects(
        db.query("select settle_order($1,'sandbox',$2,1,'v1','b1','paid')", [
          order.id,
          order.tran_id,
        ]),
      );
      await assert.rejects(
        db.query("select settle_order($1,'live',$2,24900,'v1','b1','paid')", [
          order.id,
          order.tran_id,
        ]),
      );
      assert.equal(
        (await db.query("select * from entitlements")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "risky payment stays under review without downloads",
    async () => {
      await db.query(
        "select settle_order($1,'sandbox',$2,24900,'v1','b1','review')",
        [order.id, order.tran_id],
      );
      assert.equal(
        (await db.query("select * from entitlements")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "late verified payment settles exactly once and cannot be downgraded",
    async () => {
      for (let i = 0; i < 2; i++)
        await db.query(
          "select settle_order($1,'sandbox',$2,24900,'v1','b1','paid')",
          [order.id, order.tran_id],
        );
      await db.query("select mark_order_unsuccessful($1,'failed')", [order.id]);
      assert.equal(
        (
          await db.query<{ status: string }>(
            "select status from orders where id=$1",
            [order.id],
          )
        ).rows[0].status,
        "paid",
      );
      assert.equal(
        (await db.query("select * from entitlements")).rows.length,
        1,
      );
      assert.equal(
        await asRole(
          "authenticated",
          other,
          async () =>
            (await db.query("select * from entitlements")).rows.length,
        ),
        0,
      );
    },
  );
  await t.test("sandbox entitlement does not buy the live book", async () => {
    await assert.rejects(
      db.query("select create_order($1,$2,'sandbox')", [reader, book]),
    );
    const live = (
      await db.query<{ v: typeof order }>(
        "select create_order($1,$2,'live') as v",
        [reader, book],
      )
    ).rows[0].v;
    assert.notEqual(live.id, order.id);
    assert.equal(
      (await db.query("select * from entitlements where mode='live'")).rows
        .length,
      0,
    );
  });
  await t.test(
    "same provider transaction cannot settle a second order",
    async () => {
      const second = (
        await db.query<{ v: typeof order }>(
          "select create_order($1,$2,'sandbox') as v",
          [other, book],
        )
      ).rows[0].v;
      await assert.rejects(
        db.query(
          "select settle_order($1,'sandbox',$2,24900,'v1','b1','paid')",
          [second.id, second.tran_id],
        ),
      );
      assert.equal(
        (
          await db.query<{ status: string }>(
            "select status from orders where id=$1",
            [second.id],
          )
        ).rows[0].status,
        "pending",
      );
    },
  );
  await t.test(
    "unpublished books disappear from the public catalogue",
    async () => {
      await db.query("update books set published=false where id=$1", [book]);
      assert.equal(
        await asRole(
          "anon",
          null,
          async () => (await db.query("select * from books")).rows.length,
        ),
        0,
      );
    },
  );
  await t.test(
    "Gmail hook permits email codes and rejects alternate providers and domains",
    async () => {
      for (const [email, provider, allowed] of [
        ["reader@gmail.com", "email", true],
        ["reader@company.com", "email", false],
        ["reader@gmail.com", "google", false],
      ] as const) {
        const result = (
          await db.query<{ v: { error?: unknown } }>(
            "select before_user_created_hook($1::jsonb) as v",
            [JSON.stringify({ user: { email, app_metadata: { provider } } })],
          )
        ).rows[0].v;
        assert.equal(!result.error, allowed);
      }
    },
  );
  await t.test("access-token hook rejects password sessions", async () => {
    const claims = {
      sub: reader,
      email: "reader@gmail.com",
      amr: [{ method: "otp" }],
    };
    for (const method of ["otp", "token_refresh"]) {
      const result = (
        await db.query<{ v: { claims: unknown } }>(
          "select gmail_otp_access_token_hook($1::jsonb) as v",
          [JSON.stringify({ authentication_method: method, claims })],
        )
      ).rows[0].v;
      assert.deepEqual(result.claims, claims);
    }
    await assert.rejects(() =>
      db.query("select gmail_otp_access_token_hook($1::jsonb)", [
        JSON.stringify({ authentication_method: "password", claims }),
      ]),
    );
    await assert.rejects(() =>
      db.query("select gmail_otp_access_token_hook($1::jsonb)", [
        JSON.stringify({
          authentication_method: "token_refresh",
          claims: { ...claims, amr: [{ method: "password" }] },
        }),
      ]),
    );
  });
  await t.test("rate limits persist and reject excess calls", async () => {
    assert.equal(
      (
        await db.query<{ v: boolean }>(
          "select consume_rate_limit('test',1,60) as v",
        )
      ).rows[0].v,
      true,
    );
    assert.equal(
      (
        await db.query<{ v: boolean }>(
          "select consume_rate_limit('test',1,60) as v",
        )
      ).rows[0].v,
      false,
    );
  });
  await t.test("file buckets are private", async () => {
    const { rows } = await db.query<{ public: boolean }>(
      "select public from storage.buckets",
    );
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => !row.public));
  });
  await t.test("preview paths and cleanup jobs are service-only", async () => {
    await db.query(`insert into book_previews(book_id,source_kind,source_path,source_page_count,preview_path,preview_pages)
      values($1,'book_pdf','private/sample.pdf',3,'private/excerpt.pdf',2)`, [book]);
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(asRole(role, role === "anon" ? null : reader,
        () => db.query("select * from book_previews")));
      await assert.rejects(asRole(role, role === "anon" ? null : reader,
        () => db.query("select * from storage_cleanup_jobs")));
      await assert.rejects(asRole(role, role === "anon" ? null : reader,
        () => db.query("select delete_unsold_book($1)", [book])));
    }
    const result = await db.query<{ preview_pages: number }>(
      "select preview_pages from book_previews where book_id=$1", [book]);
    assert.equal(result.rows[0].preview_pages, 2);
  });
  await t.test("service role can place orders through the sellability trigger", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    await db.query(`insert into books(id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,category,price_paisa,pages,published)
      values($1,'sellable-test','বই','Sellable test','লেখক','Author','বিবরণ','Description','fiction',1000,2,true)`, [id]);
    await db.query("insert into book_formats(book_id,format,storage_path,original_name,size_bytes) values($1,'pdf','private/sellable.pdf','sellable.pdf',100)", [id]);
    const placed = await asRole("service_role", null,
      () => db.query("select create_order($1,$2,'sandbox')", [reader, id]));
    assert.equal(placed.rows.length, 1);
    await db.query("update books set archived_at=now(),published=false where id=$1", [id]);
    await assert.rejects(asRole("service_role", null,
      () => db.query("select create_order($1,$2,'sandbox')", [other, id])), /book_unavailable/);
  });
  await t.test("PDF replacement updates paid file and excerpt together", async () => {
    await db.query("select replace_pdf_with_preview($1,$2,$3,$4,$5,$6,$7,$8)",
      [book, "private/new.pdf", "new.pdf", 200, "private/new-excerpt.pdf", 2, 4, "private/excerpt.pdf"]);
    const { rows } = await db.query<{ storage_path: string; preview_path: string; source_path: string }>(
      "select f.storage_path,p.preview_path,p.source_path from book_formats f join book_previews p on p.book_id=f.book_id where f.book_id=$1 and f.format='pdf'", [book]);
    assert.equal(rows[0].storage_path, "private/new.pdf");
    assert.equal(rows[0].preview_path, "private/new-excerpt.pdf");
    assert.equal(rows[0].source_path, "private/new.pdf");
    await assert.rejects(() => db.query("select replace_pdf_with_preview($1,$2,$3,$4,$5,$6,$7,$8)",
      [book, "private/bad.pdf", "bad.pdf", 100, "private/bad-excerpt.pdf", 4, 4, "private/new-excerpt.pdf"]));
    const unchanged = await db.query<{ storage_path: string }>(
      "select storage_path from book_formats where book_id=$1 and format='pdf'", [book]);
    assert.equal(unchanged.rows[0].storage_path, "private/new.pdf");
  });
  await t.test("stale preview saves fail without replacing the active excerpt", async () => {
    await db.query("select save_book_preview($1,$2,$3,$4,$5,$6,$7,$8)",
      [book, "private/new-excerpt.pdf", "private/new.pdf", "book_pdf",
        "private/new.pdf", 4, "private/latest-excerpt.pdf", 1]);
    await assert.rejects(() => db.query("select save_book_preview($1,$2,$3,$4,$5,$6,$7,$8)",
      [book, "private/new-excerpt.pdf", "private/new.pdf", "book_pdf",
        "private/new.pdf", 4, "private/stale-excerpt.pdf", 2]), /preview_changed/);
    const current = await db.query<{ preview_path: string; preview_pages: number }>(
      "select preview_path,preview_pages from book_previews where book_id=$1", [book]);
    assert.equal(current.rows[0].preview_path, "private/latest-excerpt.pdf");
    assert.equal(current.rows[0].preview_pages, 1);
    await assert.rejects(() => db.query("select replace_pdf_without_preview($1,$2,$3,$4,$5)",
      [book, "private/stale-paid.pdf", "stale-paid.pdf", 100, null]), /preview_changed/);
    const paid = await db.query<{ storage_path: string }>(
      "select storage_path from book_formats where book_id=$1 and format='pdf'", [book]);
    assert.equal(paid.rows[0].storage_path, "private/new.pdf");
  });
  await t.test("ordered books archive without losing a buyer's entitlement", async () => {
    await assert.rejects(() => db.query("select delete_unsold_book($1)", [book]), /book_has_orders/);
    await db.query("update books set archived_at=now(),published=false where id=$1", [book]);
    assert.equal((await asRole("anon", null,
      () => db.query("select id from books where id=$1", [book]))).rows.length, 0);
    const access = await asRole("authenticated", reader,
      () => db.query("select book_id from entitlements where book_id=$1", [book]));
    assert.equal(access.rows.length, 1);
    await db.query("update books set archived_at=null where id=$1", [book]);
    const restored = await db.query<{ published: boolean }>("select published from books where id=$1", [book]);
    assert.equal(restored.rows[0].published, false);
  });
  await t.test("unsold deletion is atomic, repeat-safe, and queues all current files", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    await db.query(`insert into books(id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,category,price_paisa,pages,cover_path)
      values($1,'delete-me','বই','Delete me','লেখক','Author','বিবরণ','Description','fiction',1000,3,'private/cover.png')`, [id]);
    await db.query("insert into book_formats(book_id,format,storage_path,original_name,size_bytes) values($1,'epub','private/ebook.epub','book.epub',100)", [id]);
    await db.query(`insert into book_previews(book_id,source_kind,source_path,source_page_count,preview_path,preview_pages)
      values($1,'sample_pdf','private/sample-source.pdf',2,'private/sample-excerpt.pdf',1)`, [id]);
    await db.query("insert into storage.objects(bucket_id,name) values('ebooks',$1)", [`${id}/old-replaced.pdf`]);
    const privilegedDelete = await asRole("service_role", null,
      () => db.query("select delete_unsold_book($1)", [id]));
    assert.equal(privilegedDelete.rows.length, 1);
    assert.equal((await db.query("select id from books where id=$1", [id])).rows.length, 1);
    await db.query("select delete_unsold_book($1)", [id]);
    assert.equal((await db.query("select id from books where id=$1", [id])).rows.length, 0);
    assert.equal((await db.query("select book_id from book_formats where book_id=$1", [id])).rows.length, 0);
    assert.equal((await db.query("select book_id from book_previews where book_id=$1", [id])).rows.length, 0);
    const jobs = await db.query<{ bucket: string; object_path: string }>(
      "select bucket,object_path from storage_cleanup_jobs where book_id=$1", [id]);
    assert.deepEqual(jobs.rows.map((row) => row.object_path).sort(),
      ["private/cover.png", "private/ebook.epub", "private/sample-excerpt.pdf", "private/sample-source.pdf", `${id}/old-replaced.pdf`].sort());
    await assert.rejects(() => db.query("select delete_unsold_book($1)", [id]), /book_not_found/);
  });
  await db.close();
});
