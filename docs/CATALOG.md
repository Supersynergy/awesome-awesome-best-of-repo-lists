# Catalog data guide

This repository indexes resource lists and catalogs. The data is a snapshot, not a live ranking or a recommendation to run code.

- [JSON Lines catalog](../data/sources.jsonl): one JSON object per entry, in UTF-8.
- [URL list](../data/urls.txt): one URL per line in catalog order, suitable for copying or scripts.
- [English catalog](../README.md) and [German catalog](../Languages/README.de.md): descriptions and expandable categories.

Each JSON object has `id`, `name`, `url`, `repo`, `cat`, `tags`, `value`, `claim`, and `evidence`; some entries also have `status`. Fields such as `value` and `claim` may contain German text. `repo` is not guaranteed to name a GitHub repository for external resources. Star counts, licenses and activity dates are historical snapshots; verify them at the source before making a decision. A list's license does not automatically cover the software it lists.

Examples (requires `jq`):

```sh
# List the names and URLs in a category.
jq -r 'select(.cat == "ai-llm-mcp") | [.name, .url] | @tsv' data/sources.jsonl

# Find entries with a particular tag.
jq -r 'select(.tags | index("security")) | [.name, .url] | @tsv' data/sources.jsonl
```

The original catalog uses `belegt`, `n.g.`, and `live` in `evidence`; these labels are source metadata and should not be interpreted as independent verification of current status.
