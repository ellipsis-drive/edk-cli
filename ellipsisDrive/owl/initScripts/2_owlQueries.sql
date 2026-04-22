INSERT INTO locations (uuid, city, country, x, y, availability_zone)
VALUES (UUID_GENERATE_V4(), 'Montreal', 'Canada', -73.62515822620395, 45.52216017892998, 'ca-central-1b');

INSERT INTO servers (location_id, name, type, ip)
VALUES (1, 'finch-1', 'finch', '10.0.140.134');

INSERT INTO servers (location_id, name, type, ip, api_url)
VALUES (1, 'pigeon-1', 'pigeon', '10.0.4.105', 'https://dev.setup.api.ellipsis-drive.com');

INSERT INTO servers (location_id, name, type, ip)
VALUES (1, 'rooster-1', 'rooster', '10.0.143.163');

INSERT INTO servers (location_id, name, type, ip)
VALUES (1, 'gull-1', 'gull', '10.0.128.10');


INSERT INTO users (uuid, username, password, email, coins, registration_date, commercial, location_id, disabled)
VALUES (UUID_GENERATE_V4(), 'admin', '$2b$10$FKp4SeBmKu26RwLjJnDNt.pzrwKdybnLlAa0SOSwrD4IuqAoHIari', 'daniel@ellipsis-drive.com', 0, NOW(), true, 1, false);

INSERT INTO user_plans (user_id, storage_limit, storage_fee, service_fee, next_service_fee, max_negative, last_changed, paid_till, storage_discount_factor, processing_units_fee, cold_storage_factor)
VALUES (1, 10000, 0, 0, 0, -10000, NOW(), NOW() + INTERVAL '1 MONTH', 0, 0, 1);

INSERT INTO user_history (user_id, date, actions, storage, max_storage, cluster_usage, upload_usage, map_usage, max_processing_units, created_maps, created_files)
VALUES (1, date_trunc('month', NOW()), 0, 0, 10000, 0, 0, 0, 1000000000, 0, 0), (1, date_trunc('month', NOW() + INTERVAL '1 MONTH'), 0, 0, 10000, 0, 0, 0, 1000000000, 0, 0);

INSERT INTO users (uuid, username, password, email, coins, registration_date, location_id)
VALUES (UUID_GENERATE_V4(), 'backoffice', '$2b$10$FKp4SeBmKu26RwLjJnDNt.pzrwKdybnLlAa0SOSwrD4IuqAoHIari', 'rens@ellipsis-newsletter.com', 0, NOW(), 1);

INSERT INTO user_plans (user_id, storage_limit, storage_fee, service_fee, next_service_fee, max_negative, last_changed, paid_till, storage_discount_factor, processing_units_fee, cold_storage_factor)
VALUES (2, 10000, 0, 0, 0, -10000, NOW(), NOW() + INTERVAL '1 MONTH', 0, 0, 1);

INSERT INTO user_history (user_id, date, actions, storage, max_storage, cluster_usage, upload_usage, map_usage, max_processing_units, created_maps, created_files)
VALUES (2, date_trunc('month', NOW()), 0, 0, 10000, 0, 0, 0, 1000000000, 0, 0), (2, date_trunc('month', NOW() + INTERVAL '1 MONTH'), 0, 0, 10000, 0, 0, 0, 1000000000, 0, 0);