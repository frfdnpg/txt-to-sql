create table "timestamps" (
 "ts1" timestamp,
 primary key ("ts1")
);

insert into "timestamps" ("ts1") values
 ('2016-11-21 10:00:01'),
 ('2010-01-21 00:10:00.009'),
 ('1969-05-06 00:10:00 -3:00'),
 ('2009-05-06 00:10:00.100 +4:00');