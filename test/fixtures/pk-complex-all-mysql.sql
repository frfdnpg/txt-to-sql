create table `pk-complex-all-mysql` (
 `'text'field` varchar,
 ```int``field` integer,
 `"num"1` numeric,
 primary key (`'text'field`, ```int``field`, `"num"1`)
);

insert into `pk-complex-all-mysql` (`'text'field`, ```int``field`, `"num"1`) values
 ('hello', 1, 3.141592),
 ('ciao', 2, 3),
 ('hello', 1, 2),
 ('ciao', 2, 4);