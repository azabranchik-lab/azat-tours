-- Message id of the moderation card in the admin group, so publish/reject can
-- update the card even when the button pressed was on another message.
ALTER TABLE cars ADD COLUMN modMessageId INTEGER;
