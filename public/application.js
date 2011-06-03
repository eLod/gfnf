var all,
    count,
    followed,
    cache = {'repos': {}, 'issues': {}, 'commits': {}, 'users': {}},
    month_names = new Array ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December');

function jsonp (url, succ) {
    count += 1;
    $.jsonp ({url: url + '?callback=' + succ, complete: function () { count -= 1; show (); }});
}

function processRepo (resp) {
    cache.repos[resp.repository.owner + '/' + resp.repository.name] = resp.repository;
}

function processIssue (resp) {
    cache.issues[resp.data.number] = resp.data;
}

function processCommit (resp) {
    cache.commits[resp.commit.id] = resp.commit;
    var login = resp.commit.committer.login || resp.commit.author.login;
    if (login != "" && typeof cache.users[login] == 'undefined') {
	cache.users[login] = null;
	jsonp ('https://api.github.com/users/' + login, 'processUser');
    }
}

function processUser (resp) {
    cache.users[resp.data.login] = resp.data;
}

function process (items) {
    var filtered = $.grep (items, function (ev) { return (ev.actor_attributes ? ev.actor_attributes : ev.actor).login != localStorage['gfnf.last_login'] && ev.type != 'GollumEvent'; });
    $.each (filtered, function (idx, ev) {
	var repo = false, i, sha;
	if (ev.repo) {
	    repo = ev.repo.name;
	    if (repo && typeof cache.repos[repo] == 'undefined') {
		cache.repos[repo] = null;
		jsonp ('https://github.com/api/v2/json/repos/show/' + repo, 'processRepo');
	    }
	} else if (ev.repository) {
	    repo = ev.repository.owner + '/' + ev.repository.name;
	    cache.repos[repo] = ev.repository;
	}
	if (ev.type == 'IssuesEvent' && typeof cache.issues[ev.payload.number] == 'undefined') {
	    cache.issues[ev.payload.number] = null;
	    jsonp ('https://api.github.com/repos/' + repo + '/issues/' + ev.payload.number, 'processIssue');
	} else if (ev.type == 'PushEvent') {
	    for (i = 0;i < 3 && i < ev.payload.shas.length;i++) {
		sha = ev.payload.shas[ev.payload.shas.length - 1 - i];
		if (typeof cache.commits[sha[0]] == 'undefined') {
		    cache.commits[sha[0]] = null;
		    jsonp ('https://github.com/api/v2/json/commits/show/' + repo + '/' + sha[0], 'processCommit');
		}
	    }
	}
    });
    return filtered;
}

function loadFollowed (resp) {
    $.merge (all, process (resp));
}

function loadFollows (resp) {
    followed.users = $.map (resp.data, function (user) { return user.login; });
    $.each (resp.data, function (idx, followed) { jsonp ('https://github.com/' + followed.login + '.json', 'loadFollowed'); });
}

function loadWatched (resp) {
    $.merge (all, process (resp.data));
}

function loadWatches (resp) {
    followed.repos = $.map (resp.repositories, function (repo) { return repo.owner + '/' + repo.name; });
    $.each (resp.repositories, function (idx, repo) {
	cache.repos[repo.owner + '/' + repo.name] = repo;
	jsonp ('https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/events', 'loadWatched');
    });
}

function loadUser (resp) {
    if (resp.meta.status == 200) {
	var name = resp.data.login;
	localStorage['gfnf.last_login'] = name;
	all = [];
	count = 0;
	followed = {'users': [], 'repos': []};
	jsonp ('https://api.github.com/users/' + name + '/following', 'loadFollows');
	jsonp ('https://github.com/api/v2/json/repos/watched/' + name, 'loadWatches');
    } else {
	change_user ();
	$('#content').prepend ('<div style="text-align: center;"><b>Error:</b> ' + resp.data.message + '</div>');
    }
}

function load (name, filter) {
    if (filter)
	localStorage['gfnf.last_filter'] = filter;
    else
	localStorage.removeItem ('gfnf.last_filter');
    $('#username').html ('');
    $('#change').hide ();
    $('#content').html ('Loading...');
    jsonp ('https://api.github.com/users/' + name, 'loadUser');
}

function valid_filter (filter_name) {
    return (localStorage['gfnf.filters'] || '').split (',').indexOf (filter_name) != -1;
}

function load_filter (filter_name, force) {
    if (typeof filter_name == 'undefined' && localStorage['gfnf.last_filter'])
	load (localStorage['gfnf.last_login'])
    else if (valid_filter (filter_name) && (filter_name != localStorage['gfnf.last_filter'] || force))
	load (localStorage['gfnf.last_login'], filter_name);
}

function update_filter_form () {
    if ($('#filter_form').length == 0) {
	$('body').append ('<div id="filter_form"><input id="filter_name" type="text"/><select id="filter_langs" multiple="multiple"></select><select id="filter_users" multiple="multiple"></select><input id="filter_rl" type="checkbox"/><label for="filter_rl" style="padding-right: 10px;">Require languages.</label><input id="filter_ru" type="checkbox"/><label for="filter_ru">Require users.</label><select id="filter_repos" multiple="multiple"></select><input id="filter_rr" type="checkbox"/><label for="filter_rr">Require repositories.</label><br/><button id="filter_save"></button><button id="filter_cancel">Cancel</button></div>');
	$.each (["ActionScript", "Ada", "Arc", "ASP", "Assembly", "Boo", "C", "C#", "C++", "Clojure", "CoffeeScript", "ColdFusion", "Common Lisp", "D", "Delphi", "Duby", "Dylan", "Eiffel", "Emacs Lisp", "Erlang",
		    "F#", "Factor", "FORTRAN", "Go", "Groovy", "Haskell", "HaXe", "Io", "Java", "JavaScript", "Lua", "Max/MSP", "Mirah", "Nu", "Objective-C", "Objective-J", "OCaml", "ooc", "Perl", "PHP", "Pure Data", "Python",
		    "R", "Racket", "Ruby", "Scala", "Scheme", "sclang", "Self", "Shell", "Smalltalk", "SuperCollider", "Tcl", "Vala", "Verilog", "VHDL", "VimL", "Visual Basic", "XQuery"], function (idx, name) {
			$('#filter_langs').append ($('<option></option>').val (name).html (name));
		});
	$('#filter_cancel').bind ('click.gfnf', function () { close_filter_form (); });
    }
    $('#filter_repos').html ('');
    $.each (followed.repos.concat ().sort (), function (idx, name) { $('#filter_repos').append ($('<option></option>').val (name).html (name)); });
    $('#filter_users').html ('');
    $.each (followed.users.concat ().sort (), function (idx, name) { $('#filter_users').append ($('<option></option>').val (name).html (name)); });
}

function filter_form (css, filter_name, cb) {
    $('#filter_name').val (filter_name ? localStorage['gfnf.filters.' + filter_name + '.name'] : 'Filter name');
    $('#filter_langs').val (filter_name ? localStorage['gfnf.filters.' + filter_name + '.langs'].split (',') : []);
    $('#filter_repos').val (filter_name ? localStorage['gfnf.filters.' + filter_name + '.repos'].split (',') : []);
    $('#filter_users').val (filter_name ? localStorage['gfnf.filters.' + filter_name + '.users'].split (',') : []);
    $('#filter_rl').attr ('checked', filter_name && localStorage['gfnf.filters.' + filter_name + '.rl'] == 'yes');
    $('#filter_rr').attr ('checked', filter_name && localStorage['gfnf.filters.' + filter_name + '.rr'] == 'yes');
    $('#filter_ru').attr ('checked', filter_name && localStorage['gfnf.filters.' + filter_name + '.ru'] == 'yes');
    $('#filter_save').html (filter_name ? 'Save' : 'Create').bind ('click.gfnf', cb);
    $('#filter_form').css (css).show ();
}

function close_filter_form () {
    $('#filter_form').hide ();
    $('#filter_save').unbind ('click.gfnf');
}

function create_filter () {
    filter_form ($('.tabs .create').offset (), null, function () {
	var filter_name = $('#filter_name').val ().replace (/[\s,]/g, '');
	if (filter_name.length == 0)
	    alert ('Invalid filter name (must contain at least 1 character that is not whitespace nor a comma).');
	else if (valid_filter (filter_name))
	    alert ('(Shortened) filter name (' + filter_name + ') already exists, please choose another one!');
	else {
	    close_filter_form ();
	    localStorage['gfnf.filters'] = localStorage['gfnf.filters'] ? (localStorage['gfnf.filters'] + ',' + filter_name) : filter_name;
	    localStorage['gfnf.filters.' + filter_name + '.name'] = $('#filter_name').val ();
	    localStorage['gfnf.filters.' + filter_name + '.langs'] = ($('#filter_langs').val () || []).join (',');
	    localStorage['gfnf.filters.' + filter_name + '.repos'] = ($('#filter_repos').val () || []).join (',');
	    localStorage['gfnf.filters.' + filter_name + '.users'] = ($('#filter_users').val () || []).join (',');
	    localStorage['gfnf.filters.' + filter_name + '.rl'] = $('#filter_rl').attr ('checked') ? 'yes' : 'no';
	    localStorage['gfnf.filters.' + filter_name + '.ru'] = $('#filter_ru').attr ('checked') ? 'yes' : 'no';
	    localStorage['gfnf.filters.' + filter_name + '.rr'] = $('#filter_rr').attr ('checked') ? 'yes' : 'no';
	    add_filter (filter_name);
	    load_filter (filter_name);
	}
    });
}

function add_filter (filter_name) {
    $('.tabs .last').before ('<li id="filter_' + filter_name + '"><a href="javascript:load_filter(\'' + filter_name + '\');" class="filterlabel">' + localStorage['gfnf.filters.' + filter_name + '.name'] + '</a><a href="javascript:edit_filter(\'' + filter_name + '\');" class="edit"></a><a href="javascript:delete_filter(\'' + filter_name + '\');" class="delete"></a></li>');
}

function delete_filter (filter_name) {
    $('.tabs #filter_' + filter_name).remove ();
    localStorage['gfnf.filters'] = localStorage['gfnf.filters'].replace (localStorage['gfnf.filters'].indexOf (filter_name) == 0 ? filter_name + "," : "," + filter_name, '');
    if (localStorage['gfnf.last_filter'] == filter_name)
	load_filter ();
}

function edit_filter (filter_name) {
    filter_form ($('.tabs #filter_' + filter_name + ' .filterlabel').offset (), filter_name, function () {
	close_filter_form ();
	localStorage['gfnf.filters.' + filter_name + '.name'] = $('#filter_name').val ();
	localStorage['gfnf.filters.' + filter_name + '.langs'] = ($('#filter_langs').val () || []).join (',');
	localStorage['gfnf.filters.' + filter_name + '.repos'] = ($('#filter_repos').val () || []).join (',');
	localStorage['gfnf.filters.' + filter_name + '.users'] = ($('#filter_users').val () || []).join (',');
	localStorage['gfnf.filters.' + filter_name + '.rl'] = $('#filter_rl').attr ('checked') ? 'yes' : 'no';
	localStorage['gfnf.filters.' + filter_name + '.ru'] = $('#filter_ru').attr ('checked') ? 'yes' : 'no';
	localStorage['gfnf.filters.' + filter_name + '.rr'] = $('#filter_rr').attr ('checked') ? 'yes' : 'no';
	load_filter (filter_name, true);
    });
}

function show () {
    if (count != 0)
	return;
    var filter_name = localStorage['gfnf.last_filter'],
	ru = localStorage['gfnf.filters.' + filter_name + '.ru'] == 'yes',
	rr = localStorage['gfnf.filters.' + filter_name + '.rr'] == 'yes',
	rl = localStorage['gfnf.filters.' + filter_name + '.rl'] == 'yes';
    if (valid_filter (filter_name))
	all = $.grep (all, function (event) {
				var repo = (event.repo && event.repo.name) || (event.repository && event.repository.owner + '/' + event.repository.name),
				    actor = event.actor_attributes ? event.actor_attributes.login : event.actor.login,
				    u = (localStorage['gfnf.filters.' + filter_name + '.users'] || '').split (',').indexOf (actor) != -1;
				if (event.type == 'FollowEvent' || event.type == "GistEvent") {
				    return u;
				} else {
				    var r = (localStorage['gfnf.filters.' + filter_name + '.repos'] || '').split (',').indexOf (repo) != -1,
					l = (localStorage['gfnf.filters.' + filter_name + '.langs'] || '').split (',').indexOf (cache.repos[repo].language) != -1;
				    return (!ru || u) && (!rr || r) && (!rl || l) && (u || r || l);
				}
	});
    all = $.map (all, function (ev) { ev['created_date'] = $.timeago.parse (ev.created_at); return ev; });
    all.sort (function (e1, e2) { return e2.created_date > e1.created_date ? 1 : -1; });
    $('#username').html ('<a href="https://github.com/' + localStorage['gfnf.last_login'] + '">' + localStorage['gfnf.last_login'] + '</a>\'s ');
    $('#change').show ();
    update_filter_form ();
    $('#content').html ('<div class="pagehead"><ul class="tabs"><li><a href="javascript:load_filter();" class="nofilter">No Filter</a></li><li class="last"><a href="javascript:create_filter();" class="create">Create Filter</a></li></ul></div><div id="dashboard"><div class="news" id="news"></div></div>');
    if (localStorage['gfnf.filters'])
	$.each (localStorage['gfnf.filters'].split (','), function (idx, filter_name) { add_filter (filter_name); });
    if (valid_filter (localStorage['gfnf.last_filter']))
	$('#filter_' + localStorage['gfnf.last_filter'] + ' .filterlabel').addClass ('selected');
    else
	$('.tabs .nofilter').addClass ('selected');
    $.each (all, function (idx, ev) { $('#news').append (format (ev)); });
}

function format (event) {
    var klass = '', title = '', details = '', repo = (event.repo && event.repo.name) || (event.repository && event.repository.owner + '/' + event.repository.name);
    switch (event.type) {
	case "WatchEvent":		klass = 'watch_' + event.payload.action;
					title = format_title (event, '<span>' + event.payload.action + ' watching</span>');
					details = format_details (event, '<div class="message">' + cache.repos[repo].name + '\'s description:<blockquote>' + cache.repos[repo].description + '</blockquote></div>');
					break;
	case "ForkEvent":		klass = 'fork';
					if (typeof event.payload.forkee == "number") {
					    title = format_title (event, '<span>forked</span> (deleted) from ');
					    details = format_details (event, '<div class="message">Forked repository has since been deleted.</div>');
					} else if (typeof event.payload.forkee == 'undefined') {
					    title = format_title (event, '<span>forked</span> ');
					    details = format_details (event, '<div class="message">Forked repository is at <a href="' + event.payload.url + '">' + event.payload.actor + '/' + event.repository.name + '</a></div>');
					} else {
					    title = format_title (event, '<span>forked</span> ');
					    details = format_details (event, '<div class="message">Forked repository is at <a href="https://github.com/' + event.payload.forkee.name + '">' + event.payload.forkee.name + '</a></div>');
					}
					break;
	case "ForkApplyEvent":		klass = 'fork_apply';
					title = format_title (event, '<span>applied</span> fork commits to');
					details = format_details (event, '<div class="message"><b>GitHub does not provide a convenient way to get commits for a ForkApplyEvent, sorry.</b></div>');
					break;
	case "PullRequestEvent":	klass = 'issues_' + event.payload.action;
					title = format_title (event, '<span>' + event.payload.action + '</span> <a href="https://github.com/' + repo + '/pull/' + event.payload.number + '">pull request ' + event.payload.number + '</a> on');
					details = format_details (event, '<div class="message"><blockquote>' + event.payload.pull_request.title + '</blockquote> ' + event.payload.pull_request.commits + ' commit with ' + event.payload.pull_request.additions + ' addition and ' + event.payload.pull_request.deletions + ' deletions</div>');
					break;
	case "IssuesEvent":		klass = 'issues_' + event.payload.action;
					title = format_title (event, '<span>' + event.payload.action + '</span> <a href="https://github.com/' + repo + '/issues/' + event.payload.number + '">issue ' + event.payload.number + '</a> on');
					details = format_details (event, '<div class="message"><blockquote><p>' + cache.issues[event.payload.number].title + '</p></blockquote></div>');
					break;
	case "IssueCommentEvent":	klass = 'issues_comment';
					title = format_title (event, '<span>commented</span> on some issue/pull request on');
					details = format_details (event, '<div class="message"><blockquote><p><b>GitHub does not provide a way to get issue/pull request information from the event, see <a href="http://support.github.com/discussions/api/307-wrong-issue_id-in-issuecommentevent">these</a> <a href="http://support.github.com/discussions/site/3386-pull-request-comments-are-tagged-as-issuecomment">discussions</a>.</p></blockquote></div>');
					break;
	case "PushEvent":		klass = 'push';
					title = format_title (event, '<span>pushed</span> to ' + event.payload.ref.replace (/^refs\/heads\//, "") + ' at');
					details = format_commits (event);
					break;
	case "CreateEvent":		klass = 'create';
					var ref_type = event.payload.ref_type || event.payload.object, ref = event.payload.ref || event.payload.object_name, master = event.payload.master_branch || 'master';
					title = format_title (event, '<span>created</span> ' + ref_type + ' <a href="https://github.com/' + repo + '/tree/' + ref + '">' + ref + '</a> at ' + repo, false);
					details = format_details (event, '<div class="message">New ' + ref_type +
									    ' is at <a href="https://github.com/' + repo + '/tree/' + ref + '">/' + repo + '/tree/' + ref + '</a>' +
									    '<br/><a href="https://github.com/' + repo + '/compare/' + ref + '">Compare ' + ref + ' ' + ref_type + ' with ' + master + ' &raquo;</a>');
					break;
	case "DeleteEvent":		klass = 'delete';
					var ref_type = event.payload.ref_type || event.payload.object, ref = event.payload.ref || event.payload.object_name;
					title = format_title (event, '<span>deleted</span> ' + ref_type + ' ' + ref + ' at');
					details = format_details (event, '<div class="message">Deleted ' + ref_type + ' was at <span style="color:#808080">' + repo + '/tree/' + ref + '</span></div>');
					break;
	case "MemberEvent":		klass = 'member_' + (event.payload.action == 'added' ? 'add' : 'remove');
					title = format_title (event, '<span>' + event.payload.action + ' member</span> <a href="https://github.com/' + event.payload.member + '">' + event.payload.member + '</a> ' + (event.payload.action == 'added' ? 'to' : 'from'));
					details = format_details (event, '<div class="message"><blockquote><p></p></blockquote></div>');
					break;
	case "CommitCommentEvent":	klass = "commit_comment";
					title = format_title (event, '<span>commented</span> on');
					details = format_details (event, '<div class="message">Comment in <a href="https://github.com/' + repo + '/commit/' + event.payload.commit + '#comments">' + event.payload.commit.substr (0, 7) + '</a>:<blockquote title="' + event.payload.comment_id + '"><p><b>GitHub does not provide an api for getting comments</b>, however here is a <a href="https://github.com/' + repo + '/commit/' + event.payload.commit + '#commitcomment-' + event.payload.comment_id + '">direct link</a>.</p></blockquote></div>');
					break;
	case "FollowEvent":		klass = "follow";
					title = format_title (event, '<span>started following</span> <a href="https://github.com/' + event.payload.target.login + '">' + event.payload.target.login + '</a>', false);
					details = format_details (event, '<div class="message">' + event.payload.target.login + ' has ' + event.payload.target.repos + ' public repos and ' + event.payload.target.followers + ' followers</div>');
					break;
	case "GistEvent":		klass = "gist";
					title = format_title (event, '<span>' + event.payload.action + 'd</span> <a href="' + event.payload.url + '">' + event.payload.name + '</a>', false);
					details = format_details (event, '<div class="message">' + event.payload.desc + '</div>');
					break;
	default:			console.log ('(error) unknown event.type', event);
					klass = '';
					title = 'ERROR (unknown event type)';
					details = 'ERROR';
    }
    return $('<div class="alert ' + klass + '"/>').append ($('<div class="body"/>').append (title).append (details));
}

function format_title (event, activity, wrl) {
    var date = event.created_date,
	date_str = (new Date().getTime () - date.getTime ()) > 1000 * 60 * 60 * 24 * 7 ? (date.getDate () + ' ' + month_names[date.getMonth ()] + ', ' + date.getFullYear ()) : $.timeago (date),
	repo = (event.repo && event.repo.name) || (event.repository && event.repository.owner + '/' + event.repository.name),
	actor = event.actor_attributes ? event.actor_attributes.login : event.actor.login;
    return '<div class="title"><a href="https://github.com/' + actor + '">' + actor + '</a> ' +
		activity + (wrl != false ? ' <a href="https://github.com/' + repo + '">' + repo + '</a>' : '') +
		' <abbr class="relatize relatized" title="' + event.created_at + '">' + date_str + '</abbr></div>';
}

function format_details (event, details) {
    return '<div class="details">' +
	    '<div class="gravatar"><img src="https://secure.gravatar.com/avatar/' + event.actor.gravatar_id + '?s=140&amp;d=https://d3nwyuy0nl342s.cloudfront.net%2Fimages%2Fgravatars%2Fgravatar-140.png" alt="" width="30" height="30"></div>' +
	    details + '</div>';
}

function format_commits (event) {
    var commits = '<div class="commits"><ul>', i, max = event.payload.size > 3 ? 3 : event.payload.size, sha, repo = (event.repo && event.repo.name) || (event.repository && event.repository.owner + '/' + event.repository.name);
    for (i = 0;i < max;i++) {
	sha = event.payload.shas[event.payload.shas.length - i - 1];
	commits += '<li>' + (cache.commits[sha[0]] ? (event.payload.shas.length > 1 ? format_thumb (cache.commits[sha[0]]) : '') : '<b>Private</b> ') + '<code><a href="https://github.com/' + repo + '/commit/' + sha[0] + '">' + sha[0].substr (0, 7) + '</a></code>' +
		    '\n<div class="message"><blockquote title="' + sha[2] + '">' + (sha[2].length > 67 ? sha[2].substr(0, 65) + '...' : sha[2]) + '</blockquote></div></li>';
    }
    if (event.actor_attributes) {
	if (event.payload.size > 1)
	    commits += '<li class="more"><a href="' + event.url + '">' + (event.payload.size > 3 ? (event.payload.size - 3) + ' more commits' : 'View comparison for these ' + event.payload.size + ' commits') + ' &raquo;</a></li>';
    } else {
	var last_sha = event.payload.shas[event.payload.shas.length - 1][0];
	if (event.payload.size > 1)
	    commits += '<li class="more"><a href="https://github.com/' + repo + '/compare/' + cache.commits[last_sha].parents[0].id.substr (0, 10) + '...' + last_sha.substr (0, 10) + '">' + (event.payload.size > 3 ? (event.payload.size - 3) + ' more commits' : 'View comparison for these ' + event.payload.size + ' commits') + ' &raquo;</a></li>';
    }
    return format_details (event, commits + '</ul></div>');
}

function format_thumb (commit) {
    var user = cache.users[commit.committer.login || commit.author.login];
    if (typeof user == 'undefined')
	user = {'login': commit.committer.name || commit.author.name, 'avatar_url': 'https://d3nwyuy0nl342s.cloudfront.net/images/gravatars/gravatar-140.png?a'};
    return '<span title="' + user.login + '"><img src="' + user.avatar_url + '&s=140" alt="' + user.login + '" width="16" height="16"/></span>';
}

function supports_html5_storage () {
    try {
	return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
	return false;
    }
}

function change_user () {
    $('#username').html ('');
    $('#change').hide ();
    $('#content').html ('<div style="text-align: center; font-size: 1.4em;"><b>Give me your GitHub name:</b> <input id="name" type="text" value="" style="width: 120px;" /> <input id="button" type="button" value="Go"/></div>');
    $('#name').keypress (function (ev) {
	if (ev.which == '13') {
	    ev.preventDefault ();
	    load ($('#name').val ());
	}
    });
    $('#button').click (function () {
	load ($('#name').val ());
    });
    $('#name').focus ();
}

$(function () {
    if (supports_html5_storage ())
	if (window.location.hash.match (/^#!\//))
	    load (window.location.hash.substr (3));
	else if (localStorage['gfnf.last_login'] == null)
	    change_user ();
	else
	    load (localStorage['gfnf.last_login'], localStorage['gfnf.last_filter']);
    else
	$('#content').html ('<div style="text-align: center; font-size: 1.4em;">I need localStorage support!</div>');
});
