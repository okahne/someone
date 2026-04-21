I want to create a backend and frontend application for finding other users currently using the app, its to support a blind date meetup

The backend and front end should be written with TypeScript created with node.js and with angular, they should communicate with websockets and they must be able to trigger push notifications
the front end and back end should have a common datamodel definition 
backend Data should be stored in a Postgres database
the setup should be done with docker containers

there are 3 types of users 
system admin
organiser 
singles

for system admin:
they can create and edit the meta imfo for  any event and get the link to the event
they can edit events and control who are organisers for an event
they need to be a regisered user and they should have a distinct login

organiser
they have to be a registered user
for events they are organisers for they can
see the names and information of singles connected to the event
define the languages this event supports, the first one is the default 
create and edit pools
for each pool they should 
define a title, title should be able to have translations from the default language
define if singles can match multiple times with the same person
define when matching call happens
define what tags the singles can have, tags should be able to have translations from the default language
create and edit meeting spots 
meeting spots have a title, a description and can have pictures
define a possible script of questions for the meeting 
define a meeting time limit


for singles:
after visiting the link for the specific event
they can either use the app in anonymus mode where they give a name and can than use the app
or they should be able to register a persistent user through sso from google and/or discord and then use the app
singles should be able to take a picture of themselves
on the main page they can then choose their mode 
1. be avalible to be contacted 
2. search for someone
3. to join the next matching call  
they also has to decide which pool to join
when you join a pool you have to select your own tags

mode avalible to be contacted
keeps you the pool and set your state to avalible

mode search for someone
the single selects which tags are manadatory for a match
then assign the single with another matching random single in state available, assign them to a meeting spot, send a push notification to the avalible user and show them both the meeting spot, change their state to moving

mode to join the next matching call
a single can see when the next matching call is, 
the single selects which tags are manadatory for a match
their status changes to booked 
can see a count down to the next call
when the time of the next call
create a set of every possible matching where two singel has the tags that each other requires, if matching the same singel multiple times is disallowed remove all matching that has already been logged before. create random pairs using Edmonds' Blossom Algorithm
for each matched pair, assign them to a meeting spot, send a push notification to the booked user and show them both the meeting spot, change their state to moving

when a pair meets at a meetingspot
a single affirms their meetup 
update their status to meeting and log the match 
If there is a script present them questions from the script 
if there is a meeting time limit send a push notification when there is 2 minutes left and when the time limit is reached
prompt the users to select a new mode

I want a definition of code stanards for the project
I want the datamodel to be documented
I want the endpoints to be documented with swagger or likewise
I want unittests for everything and end to end tests for every scenarion including the admin steps
I want an an implementation that follows the above


