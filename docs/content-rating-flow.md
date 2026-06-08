# Content rating classification and filter flow

AIOMetadata exposes one global content-rating setting (`ageRating`) with US-style labels:
`None`, `G`, `PG`, `PG-13`, `R`, and `NC-17`. Series are compared with the TV
rating equivalents (`G` → `TV-G`, `PG` → `TV-PG`, `PG-13` → `TV-14`, and
`R`/`NC-17` → `TV-MA`).

## Where classifications come from

1. **Metadata enrichment fetches ratings from the selected metadata provider.**
   TMDB-backed movie metadata fetches `release_dates`; TMDB-backed series metadata fetches
   `content_ratings`; TVDB-backed series metadata fetches TVDB `contentRatings`.
2. **Two certification fields are attached to the Stremio meta object.**
   - `app_extras.certification` is the canonical US rating when a US rating exists.
   - `app_extras.certificationLocal` is the rating for the user's configured language region
     (for example the `GB` part of `en-GB`) when available, otherwise it falls back to the US rating.
3. **Display is separate from filtering.**
   When `displayAgeRating` is enabled, the UI link uses `certificationLocal` for display. The
   content filter uses all known candidate ratings, not only the displayed rating.

## Catalog filter order

Catalog results are first fetched from their source and converted into enriched Stremio meta objects.
After enrichment, `applyCatalogFilters` applies filters in this order:

1. Content rating (`ageRating`) for non-search catalogs.
2. Digital-release visibility.
3. Unreleased-show visibility.
4. Watched-item hiding for Trakt, AniList, and MDBList.
5. Keyword, regex, and genre exclusion filters.

Search catalogs intentionally skip the global content-rating filter in `applyCatalogFilters`; search-specific
visibility toggles still apply where configured.

## Content rating comparison rules

The filter converts ratings to approximate minimum viewer ages:

| User setting | Movie max age | Series equivalent | Series max age |
| --- | ---: | --- | ---: |
| `G` | 0 | `TV-G` | 0 |
| `PG` | 7 | `TV-PG` | 7 |
| `PG-13` | 13 | `TV-14` | 14 |
| `R` | 17 | `TV-MA` | 17 |
| `NC-17` | 18 | `TV-MA` | 17 |

For each result, the filter checks every candidate rating on the meta object:
`app_extras.certification`, `app_extras.certificationLocal`, `certification`, and `contentRating`.
Known non-US labels and numeric labels such as `12`, `12+`, `16`, `18`, `MA15+`, and `R18+` are
normalized to ages before comparison.

A result is allowed when at least one known candidate rating is at or below the configured maximum. This
fixes the old US-only failure mode: if TMDB or TVDB has no US rating but does have a local rating such as
`12`, a `PG-13` movie filter can keep the item instead of hiding it solely because the US rating is blank.

If no candidate rating can be interpreted, restrictive filters fail closed and hide the item. `R` and
`NC-17` are treated as non-restrictive enough to keep unrated/unknown items, matching the previous behavior.

## Why TMDB discover no longer receives the global rating filter

TMDB discover certification filtering requires a single `certification_country`. The previous implementation
always sent `certification_country=US` plus US labels such as `PG-13`. That upstream pre-filter removed titles
before AIOMetadata could inspect local classifications. For example, a title with a local `12` rating but no US
rating could never reach the post-enrichment filter.

AIOMetadata now performs the global age-rating decision after metadata enrichment, where both US and local
ratings are available. Custom TMDB Discover catalogs can still use explicit certification parameters; the
server only removes malformed certification parameters that omit `certification_country`.
