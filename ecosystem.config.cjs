module.exports = {
  apps: [
    {
      name: 'cbeta-frontend',
      cwd: './packages/frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
    {
      name: 'cbeta-backend',
      cwd: './packages/backend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_HOST: '101.100.174.21',
        DB_PORT: 5432,
        DB_NAME: 'cbeta',
        DB_USER: 'guang',
        DB_PASSWORD: 'Root,./000000',
      },
    },
  ],
}
