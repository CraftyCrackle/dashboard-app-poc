#!/bin/bash

# Wait for MongoDB to be ready
until mongosh --eval "print(\"waited for connection\")"
do
    sleep 1
done

# Initialize replica set
mongosh --eval "
try {
    rs.status()
} catch(err) {
    rs.initiate({
        _id: 'rs0',
        members: [{
            _id: 0,
            host: 'localhost:27017'
        }]
    })
}
"

# Wait for replica set to be initiated
until mongosh --eval "rs.isMaster().ismaster" | grep true
do
    sleep 1
done

echo "MongoDB replica set initialized" 