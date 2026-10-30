import { Suspense } from "react";
import { PostList } from "@/components/posts/post-list";
import { ListSkeleton } from "@/components/ui/skeleton";
import * as accounts from "@/controllers/accounts";
import { previews } from "@/controllers/media";
import * as posts from "@/controllers/posts";
import { requireUser } from "@/lib/auth";

export default function PostsPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
        <p className="text-sm text-muted-foreground">Agende, publique e acompanhe seus posts no Instagram.</p>
      </div>
      <Suspense fallback={<ListSkeleton label="Carregando posts…" />}>
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
  // First media of each post as a thumbnail. Published posts have theirs released, so they get none.
  const thumbs = new Map(
    (await previews(user.id, rows.flatMap((p) => p.media_ids.slice(0, 1)))).map((m) => [m.id, m]),
  );
  const accountOptions = accountRows.map((a) => ({ id: a.id, username: a.username, status: a.status }));
  const username = new Map(accountRows.map((a) => [a.id, a.username]));

  return (
    <PostList
      accounts={accountOptions}
      posts={rows.map((p) => {
        const thumb = thumbs.get(p.media_ids[0]);
        return {
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
          preview: thumb ? { kind: thumb.kind, url: thumb.url } : null,
        };
      })}
    />
  );
}
