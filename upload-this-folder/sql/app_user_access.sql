-- User table of the Commercial Portal: who may sign in and what they may see.
-- Sign-in: Google (OIDC, restricted to the Bosta domain) returns a verified email; the API looks it up here.
--   no row, or status <> 'active'  ->  "no access" (nothing is shown)
--   a row                          ->  the person's scope comes from role + head_id + tl_id (VP: all; head: his team; team leader: his AMs and sales; AM / sales: own view)
-- The rows are generated from the emails of the monthly targets workbook by scripts/build_access.py (data/user_access.sql, private).
CREATE SCHEMA IF NOT EXISTS app;
CREATE TABLE IF NOT EXISTS app.user_access (
  email         VARCHAR(256) NOT NULL,       -- lower case, @bosta.co
  employee_name VARCHAR(256) NOT NULL,       -- the name shown in the app (short form)
  role          VARCHAR(32)  NOT NULL,       -- VP | Head | Team Leader | Account Manager | Sales Manager
  team          VARCHAR(64),                 -- Key, Growth - Fashion, ... (NULL for the VP)
  head_id       VARCHAR(16),                 -- the head's id in the targets workbook (h1..h5)
  tl_id         VARCHAR(16),                 -- the team leader's id (t1..t9); NULL if the person reports to a head
  access_key    VARCHAR(256) NOT NULL,       -- vp | h:<id> | t:<id> | a:<AM name> | s:<id>
  status        VARCHAR(16)  NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP    NOT NULL DEFAULT GETDATE(),
  PRIMARY KEY (email)
);
