import { Suspense } from "react";
import { PostForm } from "@/components/posts/post-form";
import { PostList } from "@/components/posts/post-list";
import * as accounts from "@/controllers/accounts";
import * as posts from "@/controllers/posts";
import { requireUser } from "@/lib/auth";

export default function PostsPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-lg font-semibold">Posts</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando posts…</p>}>
        <Posts />
      </Suspense>
    </div>
  );
}

async function Posts() {
  const user = await requireUser();
  const [accountRows, rows] = await Promise.all([
    accounts.list(user.id),
    posts.list(user.id, user.timezone),
  ]);
  const accountOptions = accountRows.map((a) => ({ id: a.id, username: a.username, status: a.status }));
  const username = new Map(accountRows.map((a) => [a.id, a.username]));

  return (
    <>
      <PostForm accounts={accountOptions} />
      <PostList
        accounts={accountOptions}
        posts={rows.map((p) => ({
          id: p.id,
          status: p.status,
          postType: p.post_type,
          caption: p.caption,
          mediaCount: p.media_ids.length,
          accountId: p.account_id,
          username: p.account_id ? (username.get(p.account_id) ?? null) : null,
          scheduledAtLocal: p.scheduledAtLocal,
          permalink: p.permalink,
          failureReason: p.failure_reason,
        }))}
      />
    </>
  );
}
