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
    ...(comment.id === commentId ? flip(comment) : comment),
    replies: comment.replies.map((reply) => (reply.id === commentId ? flip(reply) : reply)),
  }));
}

export function insertReply(comments: readonly PublicComment[], parentId: string, reply: PublicReply): PublicComment[] {
  return comments.map((comment) =>
    comment.id === parentId ? { ...comment, replies: [...comment.replies, reply] } : comment,
  );
}

export function replaceCommentBody(
  comments: readonly PublicComment[],
  commentId: string,
  body: string,
): PublicComment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return { ...comment, body };
    }
    return {
      ...comment,
      replies: comment.replies.map((reply) => (reply.id === commentId ? { ...reply, body } : reply)),
    };
  });
}

export function removeOwnPost(comments: readonly PublicComment[], commentId: string): PublicComment[] {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      replies: comment.replies.filter((reply) => reply.id !== commentId),
    }));
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
    if (!kept) {
      return item;
    }
    return { ...item, likedByMe: kept.likedByMe, likeCount: kept.likeCount };
  };

  return server.map((comment) => ({
    ...apply(comment),
    replies: comment.replies.map(apply),
  }));
}
