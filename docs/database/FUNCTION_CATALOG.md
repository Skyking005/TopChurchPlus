# TopChurchPlus Function Catalog

Generated: 2026-06-14
Source: live PostgreSQL metadata via pg_catalog / information_schema
Database: postgres
Schema scope: non-system PostgreSQL schemas

This is documentation only. No schema changes were performed.

| Schema | Name | Type | Arguments | Result | Language | Module |
| --- | --- | --- | --- | --- | --- | --- |
| public | `armor` | function | bytea | text | c | unknown |
| public | `armor` | function | bytea, text[], text[] | text | c | unknown |
| public | `cash_dist` | function | money, money | money | c | unknown |
| public | `crypt` | function | text, text | text | c | unknown |
| public | `date_dist` | function | date, date | integer | c | unknown |
| public | `dearmor` | function | text | bytea | c | unknown |
| public | `decrypt` | function | bytea, bytea, text | bytea | c | unknown |
| public | `decrypt_iv` | function | bytea, bytea, bytea, text | bytea | c | unknown |
| public | `digest` | function | bytea, text | bytea | c | unknown |
| public | `digest` | function | text, text | bytea | c | unknown |
| public | `encrypt` | function | bytea, bytea, text | bytea | c | unknown |
| public | `encrypt_iv` | function | bytea, bytea, bytea, text | bytea | c | unknown |
| public | `float4_dist` | function | real, real | real | c | unknown |
| public | `float8_dist` | function | double precision, double precision | double precision | c | unknown |
| public | `gbt_bit_compress` | function | internal | internal | c | unknown |
| public | `gbt_bit_consistent` | function | internal, bit, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_bit_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_bit_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_bit_same` | function | gbtreekey_var, gbtreekey_var, internal | internal | c | unknown |
| public | `gbt_bit_union` | function | internal, internal | gbtreekey_var | c | unknown |
| public | `gbt_bool_compress` | function | internal | internal | c | unknown |
| public | `gbt_bool_consistent` | function | internal, boolean, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_bool_fetch` | function | internal | internal | c | unknown |
| public | `gbt_bool_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_bool_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_bool_same` | function | gbtreekey2, gbtreekey2, internal | internal | c | unknown |
| public | `gbt_bool_union` | function | internal, internal | gbtreekey2 | c | unknown |
| public | `gbt_bpchar_compress` | function | internal | internal | c | unknown |
| public | `gbt_bpchar_consistent` | function | internal, character, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_bytea_compress` | function | internal | internal | c | unknown |
| public | `gbt_bytea_consistent` | function | internal, bytea, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_bytea_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_bytea_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_bytea_same` | function | gbtreekey_var, gbtreekey_var, internal | internal | c | unknown |
| public | `gbt_bytea_union` | function | internal, internal | gbtreekey_var | c | unknown |
| public | `gbt_cash_compress` | function | internal | internal | c | unknown |
| public | `gbt_cash_consistent` | function | internal, money, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_cash_distance` | function | internal, money, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_cash_fetch` | function | internal | internal | c | unknown |
| public | `gbt_cash_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_cash_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_cash_same` | function | gbtreekey16, gbtreekey16, internal | internal | c | unknown |
| public | `gbt_cash_union` | function | internal, internal | gbtreekey16 | c | unknown |
| public | `gbt_date_compress` | function | internal | internal | c | unknown |
| public | `gbt_date_consistent` | function | internal, date, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_date_distance` | function | internal, date, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_date_fetch` | function | internal | internal | c | unknown |
| public | `gbt_date_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_date_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_date_same` | function | gbtreekey8, gbtreekey8, internal | internal | c | unknown |
| public | `gbt_date_union` | function | internal, internal | gbtreekey8 | c | unknown |
| public | `gbt_decompress` | function | internal | internal | c | unknown |
| public | `gbt_enum_compress` | function | internal | internal | c | unknown |
| public | `gbt_enum_consistent` | function | internal, anyenum, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_enum_fetch` | function | internal | internal | c | unknown |
| public | `gbt_enum_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_enum_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_enum_same` | function | gbtreekey8, gbtreekey8, internal | internal | c | unknown |
| public | `gbt_enum_union` | function | internal, internal | gbtreekey8 | c | unknown |
| public | `gbt_float4_compress` | function | internal | internal | c | unknown |
| public | `gbt_float4_consistent` | function | internal, real, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_float4_distance` | function | internal, real, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_float4_fetch` | function | internal | internal | c | unknown |
| public | `gbt_float4_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_float4_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_float4_same` | function | gbtreekey8, gbtreekey8, internal | internal | c | unknown |
| public | `gbt_float4_union` | function | internal, internal | gbtreekey8 | c | unknown |
| public | `gbt_float8_compress` | function | internal | internal | c | unknown |
| public | `gbt_float8_consistent` | function | internal, double precision, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_float8_distance` | function | internal, double precision, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_float8_fetch` | function | internal | internal | c | unknown |
| public | `gbt_float8_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_float8_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_float8_same` | function | gbtreekey16, gbtreekey16, internal | internal | c | unknown |
| public | `gbt_float8_union` | function | internal, internal | gbtreekey16 | c | unknown |
| public | `gbt_inet_compress` | function | internal | internal | c | unknown |
| public | `gbt_inet_consistent` | function | internal, inet, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_inet_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_inet_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_inet_same` | function | gbtreekey16, gbtreekey16, internal | internal | c | unknown |
| public | `gbt_inet_union` | function | internal, internal | gbtreekey16 | c | unknown |
| public | `gbt_int2_compress` | function | internal | internal | c | unknown |
| public | `gbt_int2_consistent` | function | internal, smallint, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_int2_distance` | function | internal, smallint, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_int2_fetch` | function | internal | internal | c | unknown |
| public | `gbt_int2_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_int2_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_int2_same` | function | gbtreekey4, gbtreekey4, internal | internal | c | unknown |
| public | `gbt_int2_union` | function | internal, internal | gbtreekey4 | c | unknown |
| public | `gbt_int4_compress` | function | internal | internal | c | unknown |
| public | `gbt_int4_consistent` | function | internal, integer, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_int4_distance` | function | internal, integer, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_int4_fetch` | function | internal | internal | c | unknown |
| public | `gbt_int4_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_int4_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_int4_same` | function | gbtreekey8, gbtreekey8, internal | internal | c | unknown |
| public | `gbt_int4_union` | function | internal, internal | gbtreekey8 | c | unknown |
| public | `gbt_int8_compress` | function | internal | internal | c | unknown |
| public | `gbt_int8_consistent` | function | internal, bigint, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_int8_distance` | function | internal, bigint, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_int8_fetch` | function | internal | internal | c | unknown |
| public | `gbt_int8_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_int8_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_int8_same` | function | gbtreekey16, gbtreekey16, internal | internal | c | unknown |
| public | `gbt_int8_union` | function | internal, internal | gbtreekey16 | c | unknown |
| public | `gbt_intv_compress` | function | internal | internal | c | unknown |
| public | `gbt_intv_consistent` | function | internal, interval, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_intv_decompress` | function | internal | internal | c | unknown |
| public | `gbt_intv_distance` | function | internal, interval, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_intv_fetch` | function | internal | internal | c | unknown |
| public | `gbt_intv_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_intv_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_intv_same` | function | gbtreekey32, gbtreekey32, internal | internal | c | unknown |
| public | `gbt_intv_union` | function | internal, internal | gbtreekey32 | c | unknown |
| public | `gbt_macad8_compress` | function | internal | internal | c | unknown |
| public | `gbt_macad8_consistent` | function | internal, macaddr8, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_macad8_fetch` | function | internal | internal | c | unknown |
| public | `gbt_macad8_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_macad8_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_macad8_same` | function | gbtreekey16, gbtreekey16, internal | internal | c | unknown |
| public | `gbt_macad8_union` | function | internal, internal | gbtreekey16 | c | unknown |
| public | `gbt_macad_compress` | function | internal | internal | c | unknown |
| public | `gbt_macad_consistent` | function | internal, macaddr, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_macad_fetch` | function | internal | internal | c | unknown |
| public | `gbt_macad_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_macad_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_macad_same` | function | gbtreekey16, gbtreekey16, internal | internal | c | unknown |
| public | `gbt_macad_union` | function | internal, internal | gbtreekey16 | c | unknown |
| public | `gbt_numeric_compress` | function | internal | internal | c | unknown |
| public | `gbt_numeric_consistent` | function | internal, numeric, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_numeric_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_numeric_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_numeric_same` | function | gbtreekey_var, gbtreekey_var, internal | internal | c | unknown |
| public | `gbt_numeric_union` | function | internal, internal | gbtreekey_var | c | unknown |
| public | `gbt_oid_compress` | function | internal | internal | c | unknown |
| public | `gbt_oid_consistent` | function | internal, oid, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_oid_distance` | function | internal, oid, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_oid_fetch` | function | internal | internal | c | unknown |
| public | `gbt_oid_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_oid_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_oid_same` | function | gbtreekey8, gbtreekey8, internal | internal | c | unknown |
| public | `gbt_oid_union` | function | internal, internal | gbtreekey8 | c | unknown |
| public | `gbt_text_compress` | function | internal | internal | c | unknown |
| public | `gbt_text_consistent` | function | internal, text, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_text_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_text_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_text_same` | function | gbtreekey_var, gbtreekey_var, internal | internal | c | unknown |
| public | `gbt_text_union` | function | internal, internal | gbtreekey_var | c | unknown |
| public | `gbt_time_compress` | function | internal | internal | c | unknown |
| public | `gbt_time_consistent` | function | internal, time without time zone, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_time_distance` | function | internal, time without time zone, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_time_fetch` | function | internal | internal | c | unknown |
| public | `gbt_time_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_time_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_time_same` | function | gbtreekey16, gbtreekey16, internal | internal | c | unknown |
| public | `gbt_time_union` | function | internal, internal | gbtreekey16 | c | unknown |
| public | `gbt_timetz_compress` | function | internal | internal | c | unknown |
| public | `gbt_timetz_consistent` | function | internal, time with time zone, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_ts_compress` | function | internal | internal | c | unknown |
| public | `gbt_ts_consistent` | function | internal, timestamp without time zone, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_ts_distance` | function | internal, timestamp without time zone, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_ts_fetch` | function | internal | internal | c | unknown |
| public | `gbt_ts_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_ts_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_ts_same` | function | gbtreekey16, gbtreekey16, internal | internal | c | unknown |
| public | `gbt_ts_union` | function | internal, internal | gbtreekey16 | c | unknown |
| public | `gbt_tstz_compress` | function | internal | internal | c | unknown |
| public | `gbt_tstz_consistent` | function | internal, timestamp with time zone, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_tstz_distance` | function | internal, timestamp with time zone, smallint, oid, internal | double precision | c | unknown |
| public | `gbt_uuid_compress` | function | internal | internal | c | unknown |
| public | `gbt_uuid_consistent` | function | internal, uuid, smallint, oid, internal | boolean | c | unknown |
| public | `gbt_uuid_fetch` | function | internal | internal | c | unknown |
| public | `gbt_uuid_penalty` | function | internal, internal, internal | internal | c | unknown |
| public | `gbt_uuid_picksplit` | function | internal, internal | internal | c | unknown |
| public | `gbt_uuid_same` | function | gbtreekey32, gbtreekey32, internal | internal | c | unknown |
| public | `gbt_uuid_union` | function | internal, internal | gbtreekey32 | c | unknown |
| public | `gbt_var_decompress` | function | internal | internal | c | unknown |
| public | `gbt_var_fetch` | function | internal | internal | c | unknown |
| public | `gbtreekey16_in` | function | cstring | gbtreekey16 | c | unknown |
| public | `gbtreekey16_out` | function | gbtreekey16 | cstring | c | unknown |
| public | `gbtreekey2_in` | function | cstring | gbtreekey2 | c | unknown |
| public | `gbtreekey2_out` | function | gbtreekey2 | cstring | c | unknown |
| public | `gbtreekey32_in` | function | cstring | gbtreekey32 | c | unknown |
| public | `gbtreekey32_out` | function | gbtreekey32 | cstring | c | unknown |
| public | `gbtreekey4_in` | function | cstring | gbtreekey4 | c | unknown |
| public | `gbtreekey4_out` | function | gbtreekey4 | cstring | c | unknown |
| public | `gbtreekey8_in` | function | cstring | gbtreekey8 | c | unknown |
| public | `gbtreekey8_out` | function | gbtreekey8 | cstring | c | unknown |
| public | `gbtreekey_var_in` | function | cstring | gbtreekey_var | c | unknown |
| public | `gbtreekey_var_out` | function | gbtreekey_var | cstring | c | unknown |
| public | `gen_random_bytes` | function | integer | bytea | c | unknown |
| public | `gen_random_uuid` | function |  | uuid | c | unknown |
| public | `gen_salt` | function | text | text | c | unknown |
| public | `gen_salt` | function | text, integer | text | c | unknown |
| public | `hmac` | function | bytea, bytea, text | bytea | c | unknown |
| public | `hmac` | function | text, text, text | bytea | c | unknown |
| public | `int2_dist` | function | smallint, smallint | smallint | c | unknown |
| public | `int4_dist` | function | integer, integer | integer | c | unknown |
| public | `int8_dist` | function | bigint, bigint | bigint | c | unknown |
| public | `interval_dist` | function | interval, interval | interval | c | unknown |
| public | `oid_dist` | function | oid, oid | oid | c | unknown |
| public | `pgp_armor_headers` | function | text, OUT key text, OUT value text | SETOF record | c | unknown |
| public | `pgp_key_id` | function | bytea | text | c | unknown |
| public | `pgp_pub_decrypt` | function | bytea, bytea | text | c | unknown |
| public | `pgp_pub_decrypt` | function | bytea, bytea, text | text | c | unknown |
| public | `pgp_pub_decrypt` | function | bytea, bytea, text, text | text | c | unknown |
| public | `pgp_pub_decrypt_bytea` | function | bytea, bytea | bytea | c | unknown |
| public | `pgp_pub_decrypt_bytea` | function | bytea, bytea, text | bytea | c | unknown |
| public | `pgp_pub_decrypt_bytea` | function | bytea, bytea, text, text | bytea | c | unknown |
| public | `pgp_pub_encrypt` | function | text, bytea | bytea | c | unknown |
| public | `pgp_pub_encrypt` | function | text, bytea, text | bytea | c | unknown |
| public | `pgp_pub_encrypt_bytea` | function | bytea, bytea | bytea | c | unknown |
| public | `pgp_pub_encrypt_bytea` | function | bytea, bytea, text | bytea | c | unknown |
| public | `pgp_sym_decrypt` | function | bytea, text | text | c | unknown |
| public | `pgp_sym_decrypt` | function | bytea, text, text | text | c | unknown |
| public | `pgp_sym_decrypt_bytea` | function | bytea, text | bytea | c | unknown |
| public | `pgp_sym_decrypt_bytea` | function | bytea, text, text | bytea | c | unknown |
| public | `pgp_sym_encrypt` | function | text, text | bytea | c | unknown |
| public | `pgp_sym_encrypt` | function | text, text, text | bytea | c | unknown |
| public | `pgp_sym_encrypt_bytea` | function | bytea, text | bytea | c | unknown |
| public | `pgp_sym_encrypt_bytea` | function | bytea, text, text | bytea | c | unknown |
| public | `time_dist` | function | time without time zone, time without time zone | interval | c | unknown |
| public | `ts_dist` | function | timestamp without time zone, timestamp without time zone | interval | c | unknown |
| public | `tstz_dist` | function | timestamp with time zone, timestamp with time zone | interval | c | unknown |
