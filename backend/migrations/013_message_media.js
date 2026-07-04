exports.up = function (knex) {
  return knex.schema.alterTable('messages', (table) => {
    table.jsonb('media_urls').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('messages', (table) => {
    table.dropColumn('media_urls');
  });
};
