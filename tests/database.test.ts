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
  await t.test("all public tables have RLS", async () => {
    const { rows } = await db.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(
      "select relname,relrowsecurity from pg_class join pg_namespace on pg_namespace.oid=relnamespace where nspname='public' and relkind='r'",
    );
    assert.equal(rows.length, 23);
    assert.ok(rows.every((r) => r.relrowsecurity));
  });
  await t.test("payment settings are service-only with validated number and owner audit", async () => {
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(asRole(role, reader, () => db.query("select * from payment_settings")));
      await assert.rejects(asRole(role, reader, () => db.query("update payment_settings set receiving_number='01712345678'")));
      await assert.rejects(asRole(role, reader, () => db.query("insert into payment_settings(id) values('other')")));
      await assert.rejects(asRole(role, reader, () => db.query("delete from payment_settings")));
    }
    await asRole("service_role", null, async () => {
      await db.query("update payment_settings set receiving_number='01812345678',updated_by=$1 where id='default'", [reader]);
      const saved = (await db.query<{ receiving_number: string; updated_by: string }>("select * from payment_settings")).rows[0];
      assert.equal(saved.receiving_number, "01812345678");
      assert.equal(saved.updated_by, reader);
    });
    await assert.rejects(db.query("update payment_settings set receiving_number='invalid'"));
    assert.equal((await db.query<{ receiving_number: string | null }>("select receiving_number from payment_settings")).rows[0].receiving_number, null);
  });
  await t.test("delivery starts Dhaka-only; owner replacements are atomic and service-only", async () => {
    assert.deepEqual((await db.query("select district,fee_paisa from delivery_districts")).rows, [{district:"Dhaka",fee_paisa:5000}]);
    for (const role of ["anon","authenticated"]) {
      await assert.rejects(asRole(role,reader,() => db.query("select * from delivery_districts")));
      await assert.rejects(asRole(role,reader,() => db.query("delete from delivery_districts")));
      await assert.rejects(asRole(role,reader,() => db.query("select save_delivery_districts('[]',$1)",[reader])));
      await assert.rejects(asRole(role,reader,() => db.query("update payment_settings set cod_enabled=true")));
    }
    const rates = [{district:"Dhaka",fee_paisa:5000},{district:"Gazipur",fee_paisa:8000}];
    await asRole("service_role",null,async () => {
      await db.query("select save_delivery_districts($1::jsonb,$2)",[JSON.stringify(rates),reader]);
      assert.deepEqual((await db.query("select district,fee_paisa from delivery_districts order by district")).rows,rates);
    });
    for (const invalid of [[rates[0],rates[0]], [{district:"Fake",fee_paisa:50}], [{district:"Dhaka",fee_paisa:-1}],
      [{district:"Dhaka",fee_paisa:1000001}], [{district:"Dhaka",fee_paisa:1.5}], [{district:"Dhaka"}], null, {}]) {
      await assert.rejects(db.query("select save_delivery_districts($1::jsonb,$2)",[JSON.stringify(invalid),reader]));
      assert.deepEqual((await db.query("select district,fee_paisa from delivery_districts")).rows,[{district:"Dhaka",fee_paisa:5000}]);
    }
    await asRole("service_role",null,async () => {
      await db.query("select save_delivery_districts('[]',$1)",[reader]);
      assert.equal((await db.query("select * from delivery_districts")).rows.length,0);
    });
    const switches=(await db.query<{bkash_enabled:boolean;cod_enabled:boolean;business_confirmed:boolean|null}>("select * from payment_settings")).rows[0];
    assert.equal(switches.bkash_enabled,true); assert.equal(switches.cod_enabled,true);
    assert.equal(switches.business_confirmed,null);
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
  await t.test("PDF page metadata can be saved without publishing a preview", async () => {
    const id = "66666666-6666-4666-8666-666666666666";
    await db.query(`insert into books(id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,category,price_paisa,pages)
      values($1,'page-metadata','বই','Page metadata','লেখক','Author','বিবরণ','Description','fiction',1000,1)`, [id]);
    await db.query("insert into book_formats(book_id,format,storage_path,original_name,size_bytes) values($1,'pdf','private/count.pdf','count.pdf',100)", [id]);
    await db.query("select save_book_preview($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, null, null, "book_pdf", "private/count.pdf", 158, null, 0]);
    const { rows } = await db.query<{ source_page_count: number; preview_pages: number; preview_path: string | null }>(
      "select source_page_count,preview_pages,preview_path from book_previews where book_id=$1", [id]);
    assert.deepEqual(rows[0], { source_page_count: 158, preview_pages: 0, preview_path: null });
    await assert.rejects(asRole("anon", null,
      () => db.query("select book_id from book_previews where book_id=$1", [id])));
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
  await t.test("manual bKash claims never unlock books without owner approval", async () => {
    const manualBook = "99999999-9999-4999-8999-999999999999";
    await db.query(`insert into books(id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,category,price_paisa,pages,published)
      values($1,'manual-book','বই','Manual book','লেখক','Author','বিবরণ','Description','fiction',34900,50,true)`, [manualBook]);
    await db.query("insert into book_formats(book_id,format,storage_path,original_name,size_bytes) values($1,'epub','private/manual.epub','manual.epub',100)", [manualBook]);
    await assert.rejects(asRole("authenticated", reader,
      () => db.query("select create_manual_order($1,$2,$3)", [reader, manualBook, "01712345678"])));
    await db.query("update payment_settings set receiving_number='01712345678',updated_by=$1 where id='default'", [reader]);
    const created = (await db.query<{ v: { id: string; amount_paisa: number; reused: boolean; mode: string; payment_method: string; manual_receive_number: string } }>(
      "select create_manual_order($1,$2,(select receiving_number from payment_settings where id='default')) as v", [reader, manualBook])).rows[0].v;
    assert.equal(created.amount_paisa, 34900);
    assert.equal(created.mode, "live");
    assert.equal(created.payment_method, "bkash_manual");
    assert.equal(created.manual_receive_number, "01712345678");
    assert.equal((await db.query("select * from payment_attempts where order_id=$1", [created.id])).rows.length, 0);
    await db.query("update payment_settings set receiving_number='01812345678' where id='default'");
    const retry = (await db.query<{ v: { id: string; reused: boolean; manual_receive_number: string } }>(
      "select create_manual_order($1,$2,(select receiving_number from payment_settings where id='default')) as v", [reader, manualBook])).rows[0].v;
    assert.equal(retry.id, created.id);
    assert.equal(retry.reused, true);
    assert.equal(retry.manual_receive_number, "01712345678");
    await assert.rejects(db.query("select submit_manual_claim($1,$2,$3,$4)", [other, created.id, "ABC123456", "1234"]), /order_missing/);
    await assert.rejects(db.query("select submit_manual_claim($1,$2,$3,$4)", [reader, created.id, "bad!", "1234"]), /invalid_transaction/);
    await db.query("select submit_manual_claim($1,$2,$3,$4)", [reader, created.id, "abc123456", "1234"]);
    const firstClaim = (await db.query<{ id: string }>("select id from manual_payment_claims where order_id=$1", [created.id])).rows[0].id;
    assert.equal((await db.query("select * from entitlements where book_id=$1 and mode='live'", [manualBook])).rows.length, 0);
    await assert.rejects(asRole("authenticated", reader,
      () => db.query("select * from manual_payment_claims")));
    await assert.rejects(asRole("authenticated", reader,
      () => db.query("select approve_manual_claim($1,$2,$3)", [created.id, firstClaim, reader])));
    const otherOrder = (await db.query<{ v: { id: string; manual_receive_number: string } }>(
      "select create_manual_order($1,$2,(select receiving_number from payment_settings where id='default')) as v", [other, manualBook])).rows[0].v;
    assert.equal(otherOrder.manual_receive_number, "01812345678");
    assert.equal((await db.query<{ manual_receive_number: string }>("select manual_receive_number from orders where id=$1", [created.id])).rows[0].manual_receive_number, "01712345678");
    await assert.rejects(db.query("select submit_manual_claim($1,$2,$3,$4)", [other, otherOrder.id, "ABC123456", "5678"]));
    await db.query("select reject_manual_claim($1,$2,$3,$4)", [created.id, firstClaim, other, "Transfer not found"]);
    assert.equal((await db.query("select * from entitlements where book_id=$1 and mode='live'", [manualBook])).rows.length, 0);
    await db.query("select submit_manual_claim($1,$2,$3,$4)", [reader, created.id, "ABC123456", "5678"]);
    const secondClaim = (await db.query<{ id: string }>("select id from manual_payment_claims where order_id=$1 and status='submitted'", [created.id])).rows[0].id;
    await db.query("select approve_manual_claim($1,$2,$3)", [created.id, secondClaim, other]);
    await db.query("select approve_manual_claim($1,$2,$3)", [created.id, secondClaim, other]);
    assert.equal((await db.query("select * from entitlements where book_id=$1 and mode='live'", [manualBook])).rows.length, 1);
    await assert.rejects(db.query("select reject_manual_claim($1,$2,$3,$4)", [created.id, secondClaim, other, "Trying to downgrade"]), /claim_not_pending/);
    await assert.rejects(db.query("select create_manual_order($1,$2,$3)", [reader, manualBook, "01712345678"]), /already_owned/);
  });
  await t.test("printed cart reserves component stock, retries safely, and COD is paid only after collection", async () => {
    const first = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const second = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    for (const [id, slug] of [[first, "printed-first"], [second, "printed-second"]]) {
      await db.query(`insert into books(id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,
        category,price_paisa,pages,published,cover_path) values($1,$2,'ছাপা','Printed','লেখক','Author',
        'ছাপা বইয়ের বিবরণ','Printed description','fiction',0,50,true,'private/cover.png')`, [id, slug]);
    }
    await db.query("select save_print_edition($1,$2,1000,2,'Received copies')", [first, reader]);
    await db.query("select save_print_edition($1,$2,1200,1,'Received copies')", [second, reader]);
    await db.query("select save_delivery_districts($1::jsonb,$2)", [JSON.stringify([{district:"Dhaka",fee_paisa:500}]), reader]);
    const bundle = (await db.query<{ id: string }>(`select save_bundle(null,'print-pair','physical','জোড়া','Print pair',
      'দুটি ছাপা বই','Two printed books',1500,true,array[$1,$2]::uuid[]) as id`, [first, second])).rows[0].id;
    const lines = JSON.stringify([{ kind: "book", id: first, quantity: 1 }, { kind: "bundle", id: bundle, quantity: 1 }]);
    const key = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await assert.rejects(asRole("authenticated", reader, () => db.query(
      "select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11)",
      [reader, key, lines, "Reader Name", "01712345678", "Dhaka", "Dhanmondi", "House 1 Road 2", "cod", null, 3000])));
    const params = [reader, key, lines, "Reader Name", "01712345678", "Dhaka", "Dhanmondi", "House 1 Road 2", "cod", null, 3000];
    const order = (await db.query<{ v: { id: string; amount_paisa: number; reused: boolean; status: string } }>(
      "select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11) as v", params)).rows[0].v;
    // Changing/removing a delivery district never changes a purchased fee or retry.
    await db.query("select save_delivery_districts($1::jsonb,$2)", [JSON.stringify([{district:"Gazipur",fee_paisa:700}]), reader]);
    assert.equal((await db.query<{shipping_fee_paisa:number}>("select shipping_fee_paisa from order_shipping where order_id=$1",[order.id])).rows[0].shipping_fee_paisa,500);
    assert.equal((await db.query<{v:{reused:boolean}}>("select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11) as v",params)).rows[0].v.reused,true);
    await assert.rejects(db.query("select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11)",
      [reader,"aaaa1111-1111-4111-8111-111111111111",lines,...params.slice(3)]),/district_unavailable/);
    await db.query("select save_delivery_districts($1::jsonb,$2)", [JSON.stringify([{district:"Dhaka",fee_paisa:500}]), reader]);
    assert.equal(order.amount_paisa, 3000);
    assert.equal(order.status, "pending");
    await db.query(`select save_bundle($1,'print-pair','physical','জোড়া','Print pair',
      'দুটি ছাপা বই','Two printed books',1800,true,array[$2,$3]::uuid[])`, [bundle, first, second]);
    assert.equal((await db.query<{ unit_price_paisa: number }>(
      "select unit_price_paisa from order_items where order_id=$1 and item_type='bundle'", [order.id])).rows[0].unit_price_paisa, 1500);
    assert.equal((await db.query<{ book_id: string }>(`select m.book_id from order_item_members m
      join order_items i on i.id=m.order_item_id where i.order_id=$1`, [order.id])).rows.length, 2);
    assert.equal((await db.query<{ v: { id: string; reused: boolean } }>(
      "select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11) as v", params)).rows[0].v.reused, true);
    assert.equal((await db.query<{ reserved: number }>("select reserved from print_editions where book_id=$1", [first])).rows[0].reserved, 2);
    await assert.rejects(db.query("select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11)",
      [other, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", JSON.stringify([{kind:"book",id:first,quantity:1}]),
        "Other Reader", "01812345678", "Dhaka", "Banani", "House 3 Road 4", "cod", null, 1500]), /out_of_stock/);
    assert.equal((await db.query("select * from entitlements where order_id=$1", [order.id])).rows.length, 0);
    await assert.rejects(asRole("authenticated", other, () => db.query("select * from order_shipping")));
    await db.query("select change_physical_order($1,$2,'target',$3,null,null,null)", [order.id, reader, "2026-12-01"]);
    await db.query("select change_physical_order($1,$2,'ship',null,'Courier A','TRACK123',null)", [order.id, reader]);
    assert.equal((await db.query<{ status: string }>("select status from orders where id=$1", [order.id])).rows[0].status, "pending");
    await db.query("select change_physical_order($1,$2,'deliver',null,null,null,null)", [order.id, reader]);
    await db.query("select change_physical_order($1,$2,'collect',null,null,null,null)", [order.id, reader]);
    assert.equal((await db.query<{ status: string }>("select status from orders where id=$1", [order.id])).rows[0].status, "paid");
    assert.equal((await db.query<{ on_hand: number; reserved: number }>(
      "select on_hand,reserved from print_editions where book_id=$1", [first])).rows[0].on_hand, 0);
    assert.equal((await db.query<{ reserved: number }>("select reserved from print_editions where book_id=$1", [first])).rows[0].reserved, 0);
  });
  await t.test("printed bKash orders require approval, cancellation releases stock, and refunds stay manual", async () => {
    const printBook = "abababab-abab-4bab-8bab-abababababab";
    await db.query(`insert into books(id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,
      category,price_paisa,pages,published,cover_path) values($1,'prepaid-print','ছাপা','Printed',
      'লেখক','Author','ছাপা বইয়ের বিবরণ','Printed description','fiction',0,50,true,'private/cover.png')`, [printBook]);
    await db.query("select save_print_edition($1,$2,1000,1,'Received a copy')", [printBook, reader]);
    const lines = JSON.stringify([{ kind: "book", id: printBook, quantity: 1 }]);
    const params = [reader, "abababab-1111-4111-8111-abababababab", lines, "Reader Name", "01712345678",
      "Dhaka", "Dhanmondi", "House 1 Road 2", "bkash_manual", "01812345678", 1500];
    await assert.rejects(db.query("select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11)",
      [...params.slice(0, 10), 1600]), /price_changed/);
    assert.equal((await db.query("select * from orders where client_key=$1", [params[1]])).rows.length, 0);
    // Only configured districts are accepted; the database recalculates the fee.
    await db.query("select save_delivery_districts($1::jsonb,$2)", [JSON.stringify([
      {district:"Dhaka",fee_paisa:500},{district:"Gazipur",fee_paisa:900},{district:"Sylhet",fee_paisa:0}]),reader]);
    const query = "select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11) as v";
    await assert.rejects(db.query(query,[...params.slice(0,5),"Chattogram",...params.slice(6)]),/district_unavailable/);
    await assert.rejects(db.query(query,[...params.slice(0,5),"Gazipur",...params.slice(6)]),/price_changed/);
    assert.equal((await db.query<{reserved:number}>("select reserved from print_editions where book_id=$1",[printBook])).rows[0].reserved,0);
    const outsideParams=[...params.slice(0,5),"Gazipur",...params.slice(6,10),1900];
    const outside=(await db.query<{v:{id:string;amount_paisa:number}}>(query,outsideParams)).rows[0].v;
    assert.equal(outside.amount_paisa,1900);
    await db.query("select change_physical_order($1,$2,'cancel')",[outside.id,reader]);
    // A new idempotency key starts a separate order after cancellation.
    params[1]="abababab-3333-4333-8333-abababababab";
    const order = (await db.query<{ v: { id: string; status: string } }>(
      "select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11) as v", params)).rows[0].v;
    await assert.rejects(db.query("select change_physical_order($1,$2,'ship',null,'Courier','TRACK1',null)",
      [order.id, reader]), /invalid_transition/);
    await db.query("select submit_manual_claim($1,$2,'PRINT123','1234')", [reader, order.id]);
    const claim = (await db.query<{ id: string }>("select id from manual_payment_claims where order_id=$1", [order.id])).rows[0].id;
    assert.equal((await db.query("select * from entitlements where order_id=$1", [order.id])).rows.length, 0);
    await db.query("select approve_manual_claim($1,$2,$3)", [order.id, claim, other]);
    await db.query("select approve_manual_claim($1,$2,$3)", [order.id, claim, other]);
    assert.equal((await db.query("select * from entitlements where order_id=$1", [order.id])).rows.length, 0);
    await db.query("select change_physical_order($1,$2,'cancel_paid',null,null,null,'Customer requested cancellation')", [order.id, other]);
    assert.equal((await db.query<{ reserved: number }>("select reserved from print_editions where book_id=$1", [printBook])).rows[0].reserved, 0);
    assert.equal((await db.query<{ refund_due: boolean }>("select refund_due from order_shipping where order_id=$1", [order.id])).rows[0].refund_due, true);
    await db.query("select change_physical_order($1,$2,'refund',null,null,null,'Refund sent')", [order.id, other]);
    assert.equal((await db.query<{ status: string }>("select status from orders where id=$1", [order.id])).rows[0].status, "refunded");
    await assert.rejects(db.query("select change_physical_order($1,$2,'refund',null,null,null,null)", [order.id, other]), /invalid_transition/);
    const codParams = [other, "abababab-2222-4222-8222-abababababab", lines, "Other Reader", "01812345678",
      "Dhaka", "Banani", "House 3 Road 4", "cod", null, 1500];
    const cod = (await db.query<{ v: { id: string } }>(
      "select create_physical_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11) as v", codParams)).rows[0].v;
    await db.query("select change_physical_order($1,$2,'cancel',null,null,null,'Buyer cancelled')", [cod.id, other]);
    assert.equal((await db.query<{ reserved: number }>("select reserved from print_editions where book_id=$1", [printBook])).rows[0].reserved, 0);
    assert.equal((await db.query<{ status: string }>("select status from orders where id=$1", [cod.id])).rows[0].status, "cancelled");
  });
  await t.test("unsold printed books delete after inventory adjustments", async () => {
    const printBook = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
    await db.query(`insert into books(id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,
      category,price_paisa,pages,published,cover_path) values($1,'unsold-print','ছাপা','Printed',
      'লেখক','Author','ছাপা বইয়ের বিবরণ','Printed description','fiction',0,50,false,'private/cover.png')`, [printBook]);
    await db.query("select save_print_edition($1,$2,1000,2,'Received copies')", [printBook, reader]);
    await db.query("select delete_unsold_book($1)", [printBook]);
    assert.equal((await db.query("select * from books where id=$1", [printBook])).rows.length, 0);
    assert.equal((await db.query("select * from inventory_events where book_id=$1", [printBook])).rows.length, 0);
  });
  await t.test("ebook bundle grants all member downloads only after verified bKash review", async () => {
    const ids = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "ffffffff-ffff-4fff-8fff-ffffffffffff"];
    for (const [index, id] of ids.entries()) {
      await db.query(`insert into books(id,slug,title_bn,title_en,author_bn,author_en,description_bn,description_en,
        category,price_paisa,pages,published) values($1,$2,'ইবুক','Ebook','লেখক','Author',
        'ইবুকের বিবরণ','Ebook description','fiction',1500,20,true)`, [id, `ebook-bundle-${index}`]);
      await db.query("insert into book_formats(book_id,format,storage_path,original_name,size_bytes) values($1,'pdf',$2,'ebook.pdf',100)",
        [id, `private/ebook-bundle-${index}.pdf`]);
    }
    const bundle = (await db.query<{ id: string }>(`select save_bundle(null,'ebook-pair','ebook','ইবুক জোড়া','Ebook pair',
      'দুটি ইবুক','Two ebooks',2500,true,array[$1,$2]::uuid[]) as id`, ids)).rows[0].id;
    const order = (await db.query<{ v: { id: string } }>(
      "select create_ebook_bundle_order($1,$2,'01712345678') as v", [other, bundle])).rows[0].v;
    assert.equal((await db.query("select * from entitlements where order_id=$1", [order.id])).rows.length, 0);
    await db.query("select submit_manual_claim($1,$2,'BUNDLE123','1234')", [other, order.id]);
    const claim = (await db.query<{ id: string }>("select id from manual_payment_claims where order_id=$1", [order.id])).rows[0].id;
    await db.query("select approve_manual_claim($1,$2,$3)", [order.id, claim, reader]);
    await db.query("select approve_manual_claim($1,$2,$3)", [order.id, claim, reader]);
    assert.equal((await db.query("select * from entitlements where order_id=$1", [order.id])).rows.length, 2);
    await assert.rejects(db.query("select create_ebook_bundle_order($1,$2,'01712345678')", [other, bundle]), /already_owned/);
  });
  await t.test("mixed bundle snapshots reserve only print stock and COD unlocks ebooks only after cash collection", async () => {
    const ids = ["14141414-1414-4141-8141-141414141414", "15151515-1515-4151-8151-151515151515"];
    for (const [i,id] of ids.entries()) await db.query(`insert into books(id,slug,title_bn,title_en,author_bn,author_en,
      description_bn,description_en,category,price_paisa,pages,published) values($1,$2,'মিশ্র বই','Mixed book','লেখক','Author',
      'বইয়ের বিবরণ','Book description','fiction',1500,20,true)`, [id, `mixed-${i}`]);
    await db.query("select save_print_edition($1,$2,2000,5,'Received copies')", [ids[0], reader]);
    await db.query("insert into book_formats(book_id,format,storage_path,original_name,size_bytes) values($1,'pdf','fixture.pdf','ebook.pdf',100)", [ids[1]]);
    const members = JSON.stringify([{ bookId: ids[0], format: "physical" }, { bookId: ids[1], format: "ebook" }]);
    const bundle = (await db.query<{ id: string }>(`select save_bundle_v2(null,'mixed-pair','mixed','মিশ্র','Mixed pair',
      'বইয়ের বান্ডেল','Book bundle',3000,true,$1::jsonb) as id`, [members])).rows[0].id;
    await assert.rejects(asRole("authenticated", reader, () => db.query(`select save_bundle_v2(null,'forbidden','mixed',
      'মিশ্র','Mixed','বিবরণ','Description',3000,true,$1::jsonb)`, [members])));
    await assert.rejects(asRole("authenticated", reader, () => db.query("select private.grant_order_ebooks($1)", [bundle])));
    const lines = JSON.stringify([{ kind: "bundle", id: bundle, quantity: 1 }]);
    const create = async (key: string, method = "cod", user = reader) => (await db.query<{ v: { id: string; reused: boolean } }>(
      "select create_physical_order($1,$2,$3::jsonb,'Fixture Reader','01712345678','Dhaka','Test area','Test street',$4,$5,3500) as v",
      [user,key,lines,method,method === "cod" ? null : "01812345678"])).rows[0].v;
    // Seed historical orders using the original RPC, then exercise fulfillment
    // with today's implementation. New mixed checkout remains forbidden.
    const previousSql = readFileSync("supabase/migrations/20261017102902_mixed_bundles.sql", "utf8");
    const oldCreate = previousSql.slice(previousSql.indexOf("create or replace function public.create_physical_order("), previousSql.indexOf("create or replace function public.create_ebook_bundle_order("));
    const newSql = readFileSync("supabase/migrations/20261027160200_district_delivery_checkout_controls.sql", "utf8");
    const newCreate = newSql.slice(newSql.indexOf("create or replace function public.create_physical_order("));
    await db.query("update shipping_settings set dhaka_paisa=500,outside_paisa=900 where id='default'");
    const createLegacy = async (key: string, method = "cod", user = reader) => {
      await db.exec(oldCreate);
      try { return await create(key,method,user); }
      finally { await db.exec(newCreate); }
    };
    await assert.rejects(create("99999999-1111-4111-8111-111111111111"), /bundle_unavailable/);
    const key = "16161616-1616-4161-8161-161616161616";
    const order = await createLegacy(key);
    assert.equal((await create(key)).reused, true);
    assert.equal((await db.query<{ reserved: number }>("select reserved from print_editions where book_id=$1", [ids[0]])).rows[0].reserved, 1);
    assert.equal((await db.query("select * from print_editions where book_id=$1", [ids[1]])).rows.length, 0);
    assert.equal((await db.query("select * from entitlements where order_id=$1", [order.id])).rows.length, 0);
    await assert.rejects(db.query("select change_physical_order($1,$2,'collect')", [order.id, other]), /invalid_transition/);
    // Later edits cannot change a pending order's purchased editions or price.
    await db.query("select save_print_edition($1,$2,1500,5,'Added printed edition')", [ids[1], reader]);
    await db.query(`select save_bundle_v2($1,'mixed-pair','physical','মিশ্র','Mixed pair','বইয়ের বান্ডেল',
      'Book bundle',4000,true,$2::jsonb)`, [bundle, JSON.stringify(ids.map((bookId) => ({ bookId, format: "physical" })))]);
    const snapshot = (await db.query<{ book_id: string; format: string }>(`select m.book_id,m.format from order_item_members m
      join order_items i on i.id=m.order_item_id where i.order_id=$1 order by m.book_id`, [order.id])).rows;
    assert.deepEqual(snapshot, [{ book_id: ids[0], format: "physical" }, { book_id: ids[1], format: "ebook" }]);
    await db.query("select change_physical_order($1,$2,'target','2026-12-01')", [order.id, other]);
    await db.query("select change_physical_order($1,$2,'ship',null,'Courier','TRACK-MIXED')", [order.id, other]);
    assert.equal((await db.query("select * from entitlements where order_id=$1", [order.id])).rows.length, 0);
    await db.query("select change_physical_order($1,$2,'deliver')", [order.id, other]);
    await db.query("select change_physical_order($1,$2,'collect')", [order.id, other]);
    const access = (await db.query<{ book_id: string }>("select book_id from entitlements where order_id=$1 and revoked_at is null", [order.id])).rows;
    assert.deepEqual(access.map((row) => row.book_id), [ids[1]]);
    await assert.rejects(db.query("select change_physical_order($1,$2,'collect')", [order.id, other]), /invalid_transition/);
    await db.query("select change_physical_order($1,$2,'return')", [order.id, other]);
    await db.query("select change_physical_order($1,$2,'refund')", [order.id, other]);
    assert.equal((await db.query("select * from entitlements where order_id=$1 and revoked_at is null", [order.id])).rows.length, 0);
    // Restore mixed definition for payment/cancellation checks.
    await db.query(`select save_bundle_v2($1,'mixed-pair','mixed','মিশ্র','Mixed pair','বইয়ের বান্ডেল',
      'Book bundle',3000,true,$2::jsonb)`, [bundle, members]);
    const prepaid = await createLegacy("17171717-1717-4171-8171-171717171717", "bkash_manual", other);
    await db.query("select submit_manual_claim($1,$2,'MIXED123','1234')", [other, prepaid.id]);
    const claim = (await db.query<{ id: string }>("select id from manual_payment_claims where order_id=$1", [prepaid.id])).rows[0].id;
    await db.query("select approve_manual_claim($1,$2,$3)", [prepaid.id,claim,reader]);
    await db.query("select approve_manual_claim($1,$2,$3)", [prepaid.id,claim,reader]);
    assert.equal((await db.query("select * from entitlements where order_id=$1 and revoked_at is null", [prepaid.id])).rows.length, 1);
    await db.query("select change_physical_order($1,$2,'cancel_paid')", [prepaid.id,reader]);
    assert.equal((await db.query("select * from entitlements where order_id=$1 and revoked_at is null", [prepaid.id])).rows.length, 0);
    assert.equal((await db.query<{ reserved: number }>("select reserved from print_editions where book_id=$1", [ids[0]])).rows[0].reserved, 0);
    const cancelled = await createLegacy("18181818-1818-4181-8181-181818181818");
    await db.query("select change_physical_order($1,$2,'cancel')", [cancelled.id,reader]);
    assert.equal((await db.query("select * from entitlements where order_id=$1", [cancelled.id])).rows.length, 0);
    await assert.rejects(db.query(`select save_bundle_v2(null,'invalid-mixed','mixed','মিশ্র','Mixed','বইয়ের বান্ডেল',
      'Book bundle',3000,true,$1::jsonb)`, [JSON.stringify(ids.map((bookId) => ({ bookId, format: "physical" })))]), /invalid_bundle/);
    const separate = (await db.query<{ v: {id: string} }>("select create_manual_order($1,$2,'01712345678') as v", [other,ids[1]])).rows[0].v;
    await db.query("select submit_manual_claim($1,$2,'SEPARATE123','1234')", [other,separate.id]);
    const separateClaim = (await db.query<{ id: string }>("select id from manual_payment_claims where order_id=$1", [separate.id])).rows[0].id;
    await db.query("select approve_manual_claim($1,$2,$3)", [separate.id,separateClaim,reader]);
    const again = await createLegacy("19191919-1919-4191-8191-191919191919", "bkash_manual", other);
    await db.query("select submit_manual_claim($1,$2,'MIXEDAGAIN','1234')", [other,again.id]);
    const againClaim = (await db.query<{ id: string }>("select id from manual_payment_claims where order_id=$1", [again.id])).rows[0].id;
    await db.query("select approve_manual_claim($1,$2,$3)", [again.id,againClaim,reader]);
    await db.query("select change_physical_order($1,$2,'cancel_paid')", [again.id,reader]);
    assert.equal((await db.query("select * from entitlements where order_id=$1 and revoked_at is null", [separate.id])).rows.length, 1);
  });
  await db.close();
});
