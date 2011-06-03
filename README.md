# GitHub Filtered News Feed

http://gfnf.heroku.com

A proof-of-concept for the [Github Follower Problem](http://bcardarella.com/post/6075296352/the-github-follower-problem). Every data retrieved from GitHub is
publicly available and is stored in the browser only (only filters and last login name are persisted). Please note: this is a proof-of-concept and obviously
lacks some details.

## Known issues

* IssueCommentEvent: there is no way to get issue/pull request information from the event (it only provides an id, but the issues api requires a number,
  furthermore issues are not differentiated from pull requests), see [these](http://support.github.com/discussions/api/307-wrong-issue_id-in-issuecommentevent)
  [discussions](http://support.github.com/discussions/site/3386-pull-request-comments-are-tagged-as-issuecomment).
* CommitCommentEvent: there is no way to get the body of a specific comment belonging to a given commit.
* ForkApplyEvent: the ForkApplyEvent does not contain the commits (shas).
* Unknown event types: there is no comprehensive list of all event types so there may be faulty entries.
* Order, paging: as there is no way to get a user's news feed (with paging without requiring a sensitive token) items have to be fetched by followed users and/or
  watched repositories. However this means that there is no convenient way to page it (eg. the results do not necessarily form the real timeline with all the events
  on the right spot).

## Copyright

Copyright (c) 2011 PoTa. See LICENSE.txt for
further details.
