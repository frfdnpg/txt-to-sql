create table "oracle-example-one" (
 "text col" varchar2(5),
 "int col" integer(1),
 "num col" number(8,6),
 "big col" longinteger(10),
 "double col" number(9,7)
);

insert into "oracle-example-one" ("text col", "int col", "num col", "big col", "double col") values
 ('hello', 1, 3.141592, 1234567890, 1.12e-101),
 (null, null, null, 0, 0.0);