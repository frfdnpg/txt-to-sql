create table "without-pk-2" (
 "text-field" character varying(5),
 "int-field" integer,
 "num-field" numeric(8,6),
 "big" bigint,
 "double" double precision
);

insert into "without-pk-2" ("text-field", "int-field", "num-field", "big", "double") values
 ('hello', 1, 3.141592, 1234567890, 1.12e-101),
 ('hella', 4, 3.141594, 1234567894, 1.12e-101),
 ('hello', null, null, 0, 0.0);