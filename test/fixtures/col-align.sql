create table "col-align" (
 "text-field" text,
 "int-field" integer,
 "numerico-el-1" numeric
);

insert into "col-align" ("text-field", "int-field", "numerico-el-1") values
 ('hello'          ,  1, 3.141592),
 ('ciao'           ,  2,        3),
 ('hello my friend',  1,        2),
 ('ciao'           ,  2,        4),
 ('hola mi amigo'  , 32,       34);