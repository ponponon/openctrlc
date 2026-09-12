#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
upstream_remote="${UPSTREAM_REMOTE:-upstream}"
upstream_branch="${UPSTREAM_BRANCH:-dev}"
upstream_ref="${upstream_remote}/${upstream_branch}"
cursor="$(sed -n 's/^- Reviewed through upstream commit: `\([0-9a-f]*\)`.*/\1/p' "$repo_dir/UPSTREAM.md" | head -n 1)"

if [[ -z "$cursor" ]]; then
  printf 'UPSTREAM.md 中没有找到 reviewed-through commit。\n' >&2
  exit 1
fi

if ! git -C "$repo_dir" show-ref --verify --quiet "refs/remotes/$upstream_ref"; then
  printf '找不到 %s，请先执行 git fetch %s %s。\n' "$upstream_ref" "$upstream_remote" "$upstream_branch" >&2
  exit 1
fi
if ! git -C "$repo_dir" show -s --format='%H' "$cursor^{commit}" >/dev/null 2>&1; then
  printf '%s 中没有记录的游标对象，请先执行 git fetch %s %s。\n' "$upstream_ref" "$upstream_remote" "$upstream_branch" >&2
  exit 1
fi
if ! git -C "$repo_dir" merge-base --is-ancestor "$cursor" "$upstream_ref"; then
  printf '上游分支 %s 尚未包含游标 %s，请先执行 git fetch %s %s。\n' "$upstream_ref" "$cursor" "$upstream_remote" "$upstream_branch" >&2
  exit 1
fi

printf '上游审查游标：%s\n' "$cursor"
printf '待审查范围：%s..%s\n\n' "$cursor" "$upstream_ref"
git -C "$repo_dir" log --first-parent --reverse --date=short \
  --format='%H\t%ad\t%s' "$cursor..$upstream_ref"
