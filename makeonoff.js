/*
 * Create file with events times; each line contains an event on,off time.
 *
 * Usage:
 * node makeonoff.js <iCal filename | URL> <output filename)
 *
 *
 * TBD:
 * - handle various recurrence cases
 * - support time/date formats: unix timestamp, readable string
 *
 * Copyright (C) 2015 Weaved, Inc.
 */

var fs = require('fs')
var http = require('http');
var https = require('https');
var ical = require('ical.js');
var util = require('util');

var g_maxRecur = 100;
var g_maxInstances = 100;

/* Debug level */
var g_debug = 0;
var g_defaultOutFile = 'onoff.txt';
var g_inf, g_outf, g_now;

/* Execution check */
var minargs = 3;
if (process.argv[1] == 'debug') ++minargs;
if (process.argv.length < minargs) {
    console.log('Usage: node ' + process.argv[1] + '<iCal filename | URL> [output filename]');
    return;
}

/* Input file (or URL) */
g_inf = process.argv[2];

/* Output file */
g_outf = process.argv[3] || g_defaultOutFile;

/* Current time (ignore all events ending before this) */
g_now = parseInt(new Date().getTime() / 1000);
if (g_debug > 1)
    console.log('now: ' + now);

/* Pre-process iCal file, generating CSV format event schedule */
getICal(g_inf, function(data) {
    if (data)
	preProcessiCal(data, g_outf);
    else
	console.log('Error: no iCal data');
});
return;

/* */


/* Get iCal data (file or URL) */
function getICal(inf, cb) {
    if (isUrl(inf)) {
	var scheme = isHTTPS(inf) ? https : http;
	var data = '';

	scheme.get(inf, function(res) {
	    console.log('status:' + res.statusCode);
	    res.on('data', function(d) {
		data += d;
	    });
	    res.on('end', function() {
		if (g_debug > 1)
		    console.log('data: ' + data);
		if (cb)
		    cb(data);
	    });
	    
	}).on('error', function(e) {
	    console.log('Could not download: ' + inf + ' : ' + e.message);
	});

    } else {
	fs.readFile(inf, 'utf8', function(err, data) {
	    if (err) {
		console.log(err);
		return 0;
	    }
	    if (cb)
		cb(data);
	});
    }
};

function preProcessiCal(data, outf) {
    var arr, jcalData, outs;

    /* Parse iCal string into ical.js structure */
    jcalData = ICAL.parse(data);
    if (g_debug > 128) {
	console.log(util.inspect(jcalData, { showHidden: true, depth: null}));
    }
    arr = createOnOffTimeList(jcalData);
    outs = arr.join("\n");
    outs += "\n";

    fs.writeFile(outf, outs, function(err) {
	if (err) {
	    return console.log(err);
	}
    });
};

function createOnOffTimeList(data) {
    var arr = new Array();
    var vcalendar = new ICAL.Component(data[1]);
    var tzcomp = vcalendar.getFirstSubcomponent("vtimezone");
    var tz = tzcomp ? new ICAL.Timezone(tzcomp) : 0;
    var dte, nrve, vevents;

    /* Process calendar events */
    vevents = vcalendar.getAllSubcomponents("vevent");
    vevents.forEach(function(ve) {
	if (arr.length > g_maxInstances)
	    return;

	/* Check if recurring event */
	if (processRecurringEvent(tz, ve, arr))
	    return;

	/* Non-recurring event */
	nrve = new ICAL.Event(ve);

	/* Ignore if event already ended */
	if (isEventDone(nrve, g_now))
	    return;

	addEventToList(arr, tz, nrve);
    });
    return arr;
};

/* Handle possible recurring event, adding instances to array */
function processRecurringEvent(tz, ve, arr) {
    var duration, expand, found = false, i, ndtsi, ndtei, nevents, rve;
    //console.log(util.inspect(ve, { showHidden: true, depth: null}));

    /* Mutable recurring event template */
    rve = new ICAL.Event(ve);
    duration = rve.duration;

    expand = new ICAL.RecurExpansion({
      component: ve,
      dtstart: ve.getFirstPropertyValue('dtstart')
    });
    if ((expand.ruleIterators && expand.ruleIterators.length > 0) ||
	(expand.ruleDates && expand.ruleDates.length > 0) ||
	(expand.exDates && expand.exDates.length > 0)) {

	found = true;

	nevents = 0;
	while( 1) {
	    ndtsi = expand.next();
	    if (!ndtsi)
		break;

	    ndtei = ndtsi.clone();
	    ndtei.addDuration(duration);

	    /* Update recurring event template */
	    rve.startDate = ndtsi;
	    rve.endDate = ndtei;

	    /* Ignore if event already ended */
	    if (isEventDone(tz, rve, g_now))
		continue;

	    addEventToList(arr, tz, rve);
	    if (++nevents > g_maxRecur)
		break;
	    if (arr.length > g_maxInstances)
		break;
	}

	/* TBD: Dates (RDATE) */
	/* TBD: exceptions (EXDATE) */

    }

    return found;
}

function addEventToList(arr, tz, ve) {
    var dts, dte, udts, udte, utcoff;

    dts = ve.startDate;
    dte = ve.endDate;
    if (!dte) {
	duration = ve.duration;
	if (!duration)
	    return;

	dte = new ICAL.Time(dts);
	dte.addDuration(duration);
    }

    udts = dts.toUnixTime();
    udte = dte.toUnixTime();

    /* Change floating time to UTC */
    if (tz) {
	utcoff = tz.utcOffset(dts);
	udts -= utcoff;
	if (dte)
	    utcoff = tz.utcOffset(dte);
	udte -= utcoff;
    }

    arr.push(udts + ',' + udte);
};

/* Check if event has already ended */
function isEventDone(tz, ve, mint) {
    var dts, dte, duration, udts, udte, utcoff;

    if (!ve || mint <= 0)
	return true;

    dts = ve.startDate;
    dte = ve.endDate;
    duration = ve.duration;

    if (!dts)
	return true;
    if (!dte && !duration)
	return true;
    if (!dte) {
	dte = new ICAL.Time(dts);
	dte.addDuration(duration);
    }
    utcoff = tz ? tz.utcOffset(dte) : 0;
    udte = dte.toUnixTime() - utcoff;

    if (dte) {
	if (udte < mint)
	    return true;
    } else {
	dts.addDuration(duration);
	utcoff = tz ? tz.utcOffset(dts) : 0;
	udts = dts.toUnixTime() - utcoff;
	if (udts < mint)
	    return true;
    }
};

function isUrl(inf) {
    if (!inf) {
	return 0;
    }
    return inf.indexOf('http') == 0 ? 1 : 0;
};
function isHTTPS(inf) {
    return inf.indexOf('https') == 0 ? 1 : 0;
};




