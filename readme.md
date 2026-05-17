to start the docker contain in dev envirement run 


docker-compose -f .\docker-compose.yml -f .\docker-compose.dev.yml up -d


DB_HOST=localhost
DB_PORT=5432
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_NAME=your_database_name
JWT_SECRET= secret-ra   ndom
PORT=3000

GEMINI_API_KEY=token

REDIS_PORT=6379
REDIS_HOST=localhost

UNSTRUCTURED_URL=localhost:8000