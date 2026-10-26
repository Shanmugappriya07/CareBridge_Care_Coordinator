// Jenkins pipeline: GitHub -> build/test -> Docker image -> Docker Hub -> Ansible deploy
pipeline {
  agent any
  environment {
    IMAGE = "${DOCKERHUB_USER}/carebridge-backend"   // set DOCKERHUB_USER in Jenkins env or replace here
    DOCKER_CREDS = credentials('dockerhub-creds')      // Jenkins username/password credential
  }
  stages {
    stage('Checkout')  { steps { checkout scm } }
    stage('Install & Test') {
      steps {
        dir('carebridge_backend') {
          sh 'npm ci'
          sh 'node --check server.js'
        }
      }
    }
    stage('Docker Build') { steps { sh 'docker build -t $IMAGE:$BUILD_NUMBER -t $IMAGE:latest .' } }
    stage('Docker Push') {
      steps {
        sh 'echo $DOCKER_CREDS_PSW | docker login -u $DOCKER_CREDS_USR --password-stdin'
        sh 'docker push $IMAGE:$BUILD_NUMBER && docker push $IMAGE:latest'
      }
    }
    stage('Deploy (Ansible)') {
      steps { sh 'ansible-playbook -i ansible/inventory.ini ansible/deploy.yml -e image=$IMAGE:latest' }
    }
  }
  post { always { sh 'docker logout || true' } }
}
