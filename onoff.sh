#!/bin/sh
#
# Turn power on/off according to times in file.
#
# File format (Unix timestamps):
#  on1,off1
#  on2,off2
#  ...
#

file="onoff.txt"

# Current relay state (1=on, 0=off)
relay=$(weavediot_relay_get.sh)
echo "relay state: $relay"
relay_new=0

# LED state
val=$(weavediot_led_on.sh)


# Current timestamp (UTC)
unow=$(date "+%s")
echo "now(UTC): $unow"

while read line
do
    [ $line ] || [ "$line" != "" ] || {
	continue
    }

    # Get next event DTSTART and DTEND
    OIFS=$IFS
    IFS=,
    i=1
    for v in $line
    do
	[ $i = 1 ] && {
	    dts=$v
	}
	[ $i = 2 ] && {
	    dte=$v
	}
	i=$(($i+1))
    done
    IFS=$OIFS

    # Check if event on or off
    if [ $dts -le $unow ] && [ $unow -le $dte ]
    then
	relay_new=1
    fi
done < $file

if [ $relay_new = 1 ]
then
    if [ $relay = 1 ]
    then
	echo "turn on but already on"
    else
	echo "turn on"
	$(weavediot_relay_on.sh)
	$(weavediot_led_on.sh 0)
    fi
else
    if [ $relay = 0 ]
    then
	echo "turn off but already off"
    else
	echo "turn off"
	$(weavediot_relay_off.sh)
	$(weavediot_led_off.sh 0)
    fi
fi
