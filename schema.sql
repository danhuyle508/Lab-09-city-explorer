DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS yelps;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS meetups;
DROP TABLE IF EXISTS trails;

CREATE TABLE locations(
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  formatted_query VARCHAR(255),
  latitude NUMERIC(8,6),
  longitude NUMERIC(9,6)
);

CREATE TABLE weathers (
  id SERIAL PRIMARY KEY,
  forecast VARCHAR(255),
  time VARCHAR(255),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);
CREATE TABLE movies (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  released_on VARCHAR(255), 
  total_votes NUMERIC(255,0), 
  average_votes NUMERIC(2,2), 
  popularity NUMERIC(2,2), 
  image_url VARCHAR(255),
  overview VARCHAR(1000),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);
CREATE TABLE yelps(
  id SERIAL PRIMARY KEY,
  url VARCHAR(255),
  name VARCHAR(255),
  rating NUMERIC(2,2),
  price VARCHAR(7),
  image_url VARCHAR(255),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations(id)
);
CREATE TABLE trails(
  id SERIAL PRIMARY KEY,
  url VARCHAR(255),
  name VARCHAR(255),
  location VARCHAR(255),
  length NUMERIC(10,10),
  condition_date VARCHAR(255),
  condition_time VARCHAR(255),
  stars NUMERIC(4,2),
  star_votes NUMERIC(10,10),
  summary VARCHAR(1000),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);
CREATE TABLE meetups(
  id SERIAL PRIMARY KEY,
  link VARCHAR(255),
  name VARCHAR(255),
  host VARCHAR(255),
  creation_date NUMERIC(20,0),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);