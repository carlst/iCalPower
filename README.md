## iCalPower: iCal calendar-based SmartPlug power controller

Turn SmartPlug on/off according to iCal calendar events.


### Purpose

This purpose of this application is turn a SmartPlug (ie. light or lights)  
on or off according to a schedule, specified by a calendar. Any calendar  
system supporting iCal format can be used.  

For simplicity, the first version of this application processes iCal data  
off-line, creating a simple file of on,off times. The file is downloaded  
to a SmartPlug and processed by a shell script. The only required change  
to the plug is a shell script (and adding execution of the script to cron).  

Future versions may use node.js, PHP or any other language with an iCal  
processing module on the SmartPlug so that calendar changes are  
automatically handled in real-time.  

### Setup

A system running node.js and the node ical.js module is required  
(npm install -g ical.js).  

Run:  
node makeonoff.js &lt;iCal file or URL&gt; [output file]  

The default output file is onoff.txt  

Download to SmartPlug /root:  
onoff.txt  
onoff.sh  

### Automating the SmartPlug script

The script can be run from crontab.  

To edit the crontab: crontab -e t  

To run every 1 minute, add the following line:  
*/1 * * * * /root/onoff.sh  

To run every 10 minutes, add the following line:  
*/10 * * * * /root/onoff.sh  

To run every 1 hour, add the following line:  
* */1 * * * /root/onoff.sh  


### Adjusting the SmartPlug Timezone

To display the current timezone, use 'date'.  

To adjust the current timezone, use a TZ string from the table:  
http://wiki.openwrt.org/doc/uci/system#time_zones  

For example, for America/Los Angeles:  
uci set system.@system[0].timezone=PST8PDT  
uci commit  

###
