import { Client, Producer, ConsumerGroup, Consumer } from 'kafka-node';

let zkClient = new Client('localhost:2181', 'producer1');
let producer = new Producer(zkClient);
producer.on('ready', () => {
    console.log('ready');
    producer.createTopics(['hello'], true, (err, data) => console.log(err, data));

    setInterval(() => producer.send([{ topic: 'hello', messages: ['hi'] }], (err, data) => { }), 1 * 1000);
});

producer.on('error', (err) => {
    console.log('error producer', err);
});

let consumer = new Consumer(zkClient, [{ topic: 'hello', }], { autoCommit: true, groupId: 'abc' });

consumer.on('message', msg => {
    console.log(msg.value, msg.offset, 'consumer1');
});

let zkClient2 = new Client('localhost:2181', 'client2');
let consumer2 = new Consumer(zkClient2, [{ topic: 'hello', }], { autoCommit: true, groupId: '111' });

consumer2.on('message', msg => {
    console.log(msg.value, msg.offset, 'consumer2');
});

consumer.on('error', () => {
    console.log('consumer1 error');
});

consumer2.on('error', () => {
    console.log('consumer2 error');
});