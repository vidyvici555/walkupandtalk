const { query } = require('../config/database');
const { createMatch } = require('../services/matchService');
const { notifyNewMatch } = require('../services/pushService');
const { sendNewMatchEmail } = require('../services/emailService');

const DAILY_SWIPE_LIMIT = parseInt(process.env.DAILY_SWIPE_LIMIT) || 50;

// GET /api/swipe/deck  — returns profiles to swipe on
// Query params: state, minAge, maxAge
const getDeck = async (req, res, next) => {
  try {
    const { state, minAge, maxAge } = req.query;

    const myProfile = await query(
      'SELECT gender, interested_in, location_state FROM profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (!myProfile.rows[0]) {
      return res.status(400).json({ error: 'Complete your profile first' });
    }

    const me = myProfile.rows[0];

    const interestToGender = { men: 'man', women: 'woman', everyone: null };
    const wantsEveryone = me.interested_in.includes('everyone');
    const targetGenders = wantsEveryone
      ? null
      : me.interested_in.map((i) => interestToGender[i] || i).filter(Boolean);

    const genderToInterest = { man: 'men', woman: 'women', 'non-binary': 'everyone' };
    const myGenderAsInterest = genderToInterest[me.gender] || me.gender;

    const swiped = await query('SELECT swiped_id FROM swipes WHERE swiper_id = $1', [req.user.id]);
    const swipedIds = swiped.rows.map((r) => r.swiped_id);
    swipedIds.push(req.user.id);

    // Exclude users this person has blocked AND users who have blocked them
    const blocked = await query(
      `SELECT blocked_id AS id FROM blocked_users WHERE blocker_id = $1
       UNION
       SELECT blocker_id AS id FROM blocked_users WHERE blocked_id = $1`,
      [req.user.id]
    ).catch(() => ({ rows: [] })); // non-fatal if migration hasn't run yet
    blocked.rows.forEach((r) => swipedIds.push(r.id));

    const excludeList = swipedIds.length > 0 ? swipedIds : ['00000000-0000-0000-0000-000000000000'];

    const ageMin = parseInt(minAge) || 18;
    const ageMax = parseInt(maxAge) || 99;
    const targetState = state || null;

    const result = await query(
      `SELECT DISTINCT ON (p.user_id)
         p.user_id AS id,
         p.display_name,
         p.gender,
         p.bio,
         p.location_city,
         p.location_state,
         p.height_cm,
         p.education,
         p.occupation,
         EXTRACT(YEAR FROM AGE(p.birthdate))::int AS age,
         pp.url AS primary_photo,
         pp.thumbnail_url
       FROM profiles p
       LEFT JOIN profile_photos pp ON p.user_id = pp.user_id AND pp.is_primary = true
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id != ALL($1::uuid[])
         AND p.is_complete = true
         AND u.is_active = true
         AND u.is_flagged = false
         AND ($2::text[] IS NULL OR p.gender = ANY($2::text[]))
         AND ($3::text IS NULL OR p.location_state = $3)
         AND ($4 = ANY(p.interested_in) OR 'everyone' = ANY(p.interested_in))
         AND EXTRACT(YEAR FROM AGE(p.birthdate)) BETWEEN $5 AND $6
       ORDER BY p.user_id, RANDOM()
       LIMIT 20`,
      [
        excludeList,
        targetGenders && targetGenders.length > 0 ? targetGenders : null,
        targetState,
        myGenderAsInterest,
        ageMin,
        ageMax,
      ]
    );

    res.json({ profiles: result.rows });
  } catch (err) {
    next(err);
  }
};

// POST /api/swipe
const swipe = async (req, res, next) => {
  try {
    const { targetUserId, direction } = req.body;

    if (!['like', 'pass'].includes(direction)) {
      return res.status(400).json({ error: 'Direction must be like or pass' });
    }
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot swipe on yourself' });
    }

    const today = new Date().toISOString().split('T')[0];
    const countResult = await query(
      `INSERT INTO daily_swipe_counts (user_id, swipe_date, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, swipe_date) DO UPDATE SET count = daily_swipe_counts.count + 1
       RETURNING count`,
      [req.user.id, today]
    );

    const todayCount = parseInt(countResult.rows[0].count);
    if (todayCount > DAILY_SWIPE_LIMIT) {
      await query(
        'UPDATE daily_swipe_counts SET count = count - 1 WHERE user_id = $1 AND swipe_date = $2',
        [req.user.id, today]
      );
      return res.status(429).json({ error: 'Daily swipe limit reached', limit: DAILY_SWIPE_LIMIT });
    }

    // Store swipe + remember last swiped for undo
    await query(
      `INSERT INTO swipes (swiper_id, swiped_id, direction)
       VALUES ($1, $2, $3)
       ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET direction = EXCLUDED.direction`,
      [req.user.id, targetUserId, direction]
    );

    // Track last swipe in DB for undo
    await query(
      `INSERT INTO user_last_swipe (user_id, swiped_id, direction, swiped_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET swiped_id = $2, direction = $3, swiped_at = NOW()`,
      [req.user.id, targetUserId, direction]
    ).catch(() => {}); // table may not exist yet — non-fatal

    let matched = false;
    let matchId = null;

    if (direction === 'like') {
      // Dev auto-like for seeded @example.com profiles
      if (process.env.NODE_ENV !== 'production') {
        const targetUser = await query('SELECT email FROM users WHERE id = $1', [targetUserId]);
        if (targetUser.rows[0]?.email?.endsWith('@example.com')) {
          await query(
            `INSERT INTO swipes (swiper_id, swiped_id, direction)
             VALUES ($1, $2, 'like')
             ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET direction = 'like'`,
            [targetUserId, req.user.id]
          );
        }
      }

      const mutual = await query(
        `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND direction = 'like'`,
        [targetUserId, req.user.id]
      );

      if (mutual.rows.length > 0) {
        const match = await createMatch(req.user.id, targetUserId);
        matched = true;
        matchId = match.id;

        const names = await query(
          `SELECT user_id, display_name FROM profiles WHERE user_id = ANY($1::uuid[])`,
          [[req.user.id, targetUserId]]
        );
        const nameMap = Object.fromEntries(names.rows.map((r) => [r.user_id, r.display_name]));

        notifyNewMatch(req.user.id, nameMap[targetUserId] || 'someone', matchId).catch(() => {});
        notifyNewMatch(targetUserId, nameMap[req.user.id] || 'someone', matchId).catch(() => {});

        query(`SELECT id, email FROM users WHERE id = ANY($1::uuid[])`, [[req.user.id, targetUserId]])
          .then((emailRes) => {
            const emailMap = Object.fromEntries(emailRes.rows.map((r) => [r.id, r.email]));
            sendNewMatchEmail(emailMap[req.user.id], nameMap[req.user.id], nameMap[targetUserId], matchId).catch(() => {});
            sendNewMatchEmail(emailMap[targetUserId], nameMap[targetUserId], nameMap[req.user.id], matchId).catch(() => {});
          }).catch(() => {});

        req.app.get('io')?.to(`user:${req.user.id}`).emit('new_match', { matchId });
        req.app.get('io')?.to(`user:${targetUserId}`).emit('new_match', { matchId });
      }
    }

    res.json({ success: true, matched, matchId, swipesRemaining: DAILY_SWIPE_LIMIT - todayCount });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/swipe/undo  — reverse the last swipe
const undoSwipe = async (req, res, next) => {
  try {
    // Get last swipe from the tracking table
    const last = await query(
      'SELECT swiped_id, direction, swiped_at FROM user_last_swipe WHERE user_id = $1',
      [req.user.id]
    );

    if (!last.rows[0]) {
      return res.status(400).json({ error: 'Nothing to undo' });
    }

    const { swiped_id, swiped_at } = last.rows[0];

    // Only allow undo within 30 seconds
    const ageSeconds = (Date.now() - new Date(swiped_at).getTime()) / 1000;
    if (ageSeconds > 30) {
      return res.status(400).json({ error: 'Undo window expired (30 seconds)' });
    }

    // Remove the swipe record
    await query('DELETE FROM swipes WHERE swiper_id = $1 AND swiped_id = $2', [req.user.id, swiped_id]);

    // Clear the last-swipe tracker
    await query('DELETE FROM user_last_swipe WHERE user_id = $1', [req.user.id]);

    // Also undo the auto-like on seeded profiles if in dev
    if (process.env.NODE_ENV !== 'production') {
      const targetUser = await query('SELECT email FROM users WHERE id = $1', [swiped_id]);
      if (targetUser.rows[0]?.email?.endsWith('@example.com')) {
        await query('DELETE FROM swipes WHERE swiper_id = $1 AND swiped_id = $2', [swiped_id, req.user.id]);
        // Also remove any accidental match
        await query(
          `UPDATE matches SET is_active = false, unmatch_reason = 'undo'
           WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))`,
          [req.user.id, swiped_id]
        );
      }
    }

    // Decrement daily swipe count
    await query(
      `UPDATE daily_swipe_counts SET count = GREATEST(0, count - 1)
       WHERE user_id = $1 AND swipe_date = $2`,
      [req.user.id, new Date().toISOString().split('T')[0]]
    );

    // Return the profile so frontend can re-add it to the deck
    const profile = await query(
      `SELECT p.user_id AS id, p.display_name, p.gender, p.bio,
              p.location_city, p.location_state, p.occupation,
              EXTRACT(YEAR FROM AGE(p.birthdate))::int AS age,
              pp.url AS primary_photo
       FROM profiles p
       LEFT JOIN profile_photos pp ON p.user_id = pp.user_id AND pp.is_primary = true
       WHERE p.user_id = $1`,
      [swiped_id]
    );

    res.json({ success: true, profile: profile.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/swipe/remaining
const getSwipesRemaining = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await query(
      'SELECT count FROM daily_swipe_counts WHERE user_id = $1 AND swipe_date = $2',
      [req.user.id, today]
    );
    const used = parseInt(result.rows[0]?.count || 0);
    res.json({ used, limit: DAILY_SWIPE_LIMIT, remaining: Math.max(0, DAILY_SWIPE_LIMIT - used) });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDeck, swipe, undoSwipe, getSwipesRemaining };
