exports.up = async function (knex) {
  await knex.schema.table('businesses', (t) => {
    t.string('join_code', 12).unique();
  });

  // Backfill existing businesses with unique join codes
  const businesses = await knex('businesses').select('id');
  for (const biz of businesses) {
    let code;
    let collision = true;
    while (collision) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existing = await knex('businesses').where('join_code', code).first();
      collision = !!existing;
    }
    await knex('businesses').where('id', biz.id).update({ join_code: code });
  }
};

exports.down = function (knex) {
  return knex.schema.table('businesses', (t) => {
    t.dropColumn('join_code');
  });
};
