ALTER TABLE app_chat_messages
  ADD COLUMN status ENUM('sent', 'delivered', 'read') NOT NULL DEFAULT 'delivered';
