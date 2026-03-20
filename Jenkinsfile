pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm run install:all'
            }
        }

        stage('Build Frontend') {
            steps {
                sh 'npm run build:frontend'
            }
        }

        stage('Deploy / Restart') {
            steps {
                sh '''
                echo "Deploying to backend server..."
                # Restart using PM2 if available, otherwise fallback to npm start
                if command -v pm2 >/dev/null 2>&1; then
                    pm2 restart backend || pm2 start backend/src/server.js --name backend
                else
                    echo "PM2 not found. Restarting using npm start (Note: This might not keep running in standard Jenkins agents)"
                    npm start &
                fi
                echo "Deployment completed"
                '''
            }
        }
    }
}

