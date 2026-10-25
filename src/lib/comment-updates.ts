import type { PublicComment, PublicReply } from "@/lib/types";

function flip(item: PublicReply): PublicReply {
  const likedByMe = !item.likedByMe;
  return {
    ...item,
    likedByMe,
    likeCount: Math.max(0, item.likeCount + (likedByMe ? 1 : -1)),
  };
}

export function toggleLocalLike(comments: readonly PublicComment[], commentId: string): PublicComment[] {
  return comments.map((comment) => ({
    ...(comment.id === commentId && !comment.mine ? flip(comment) : comment),
    replies: comment.replies.map((reply) => (reply.id === commentId && !reply.mine ? flip(reply) : reply)),
  }));
}

export function insertReply(comments: readonly PublicComment[], parentId: string, reply: PublicReply): PublicComment[] {
  return comments.map((comment) =>
    comment.id === parentId ? { ...comment, replies: [...comment.replies, reply] } : comment,
  );
}

export function removeReply(comments: readonly PublicComment[], replyId: string): PublicComment[] {
  return comments.map((comment) => ({
    ...comment,
    replies: comment.replies.filter((reply) => reply.id !== replyId),
  }));
}

export function adoptServerComments(local: readonly PublicComment[], server: readonly PublicComment[]): PublicComment[] {
  const likes = new Map<string, { likedByMe: boolean; likeCount: number }>();
  for (const comment of local) {
    likes.set(comment.id, { likedByMe: comment.likedByMe, likeCount: comment.likeCount });
    for (const reply of comment.replies) {
      likes.set(reply.id, { likedByMe: reply.likedByMe, likeCount: reply.likeCount });
    }
  }

  const apply = (item: PublicReply): PublicReply => {
    const kept = likes.get(item.id);
    if (!kept || item.mine) {
      return item;
    }
    return { ...item, likedByMe: kept.likedByMe, likeCount: kept.likeCount };
  };

  return server.map((comment) => ({
    ...apply(comment),
    replies: comment.replies.map(apply),
  }));
}
