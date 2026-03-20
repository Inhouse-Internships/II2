pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                // Pulls the latest code from the configured repository
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                // Uses the script defined in your root package.json
                sh 'npm run install:all'
            }
        }

        stage('Build Frontend') {
            steps {
                // Generates the 'dist' folder for the backend to serve
                sh 'npm run build:frontend'
            }
        }

        stage('Deploy / Restart Server') {
            steps {
                // Restarts the backend using PM2 (common for Node.js production)
                // If PM2 isn't installed on the server, you will need to install it: npm install -g pm2
                sh 'pm2 restart ii2-backend || pm2 start backend/src/server.js --name ii2-backend'
            }
        }
    }

    post {
        success {
            echo 'Deployment successful!'
        }
        failure {
            echo 'Deployment failed. Check the logs above.'
        }
    }
}
