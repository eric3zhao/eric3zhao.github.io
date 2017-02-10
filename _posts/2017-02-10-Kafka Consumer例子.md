# Kafka Consumer例子
去年开始学习kafka，写了一个消费者的例子，最近回顾的时候发现一个问题，首先看当初写的例子
先写一个消费者类
```
public class KafkaMessageConsumer {
    private KafkaConsumer consumer;
    private List<String> topics;

    public KafkaMessageConsumer(String groupId, List<String> topics, String server,String keyDeserializer, String valueDeserializer) {
        this.topics = topics;
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, server);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, keyDeserializer);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, valueDeserializer);
        this.consumer = new KafkaConsumer(props);
    }

    public void processMessage() {
        try {
            consumer.subscribe(topics);
            while (true) {
                ConsumerRecords<Integer, byte[]> records = consumer.poll(Long.MAX_VALUE);
                for (ConsumerRecord record : records) {
                    Map<String, Object> data = new HashMap<String, Object>();
                    data.put("partition", record.partition());
                    data.put("offset", record.offset());
                    data.put("value", record.value());
                    System.out.println(data);
                    try {
                        TimeUnit.SECONDS.sleep(1);
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
            }
        }catch (WakeupException e){
            //NOOP
        }finally {
            System.out.println("消费者close");
            consumer.close();
        }
    }

    public void shutDown(){
        System.out.println("消费者wakeup");
        consumer.wakeup();
    }
}
```
main函数的代码如下
```
public class KafkaExample {

    private KafkaMessageConsumer consumer;

    private void addShutDownHook() {
        Runtime.getRuntime().addShutdownHook(new Thread() {
            public void run() {
                consumer.shutDown();
            }
        });
    }

    public void init() {
        this.addShutDownHook();
        consumer = new KafkaMessageConsumer("test",
                Arrays.asList("bytetest222"),
                "127.0.0.1:9092,127.0.0.1:9093",
  "org.apache.kafka.common.serialization.IntegerDeserializer",
"org.apache.kafka.common.serialization.ByteArrayDeserializer");
    }

    public void start() {
        System.out.println("开始消费！");
        consumer.processMessage();
    }

    public static void main(String[] args) {
        KafkaExample example = new KafkaExample();
        example.init();
        example.start();
    }
}
```

开始运行main函数，当程序运行时点击停止，可以看到并没有调用`consumer.close();`程序就退出了
![截图1](/assets/images/20170210-150456.png)
为了解决这个问题，可以使用`CountDownLatch`来控制。
修改后的代码段如下
```
public void processMessage() {
        try {
            consumer.subscribe(topics);
            while (true) {
                ConsumerRecords<Integer, byte[]> records = consumer.poll(Long.MAX_VALUE);
                for (ConsumerRecord record : records) {
                    //do something
                }

            }
        }catch (WakeupException e){
            //NOOP
        }finally {
            System.out.println("消费者close");
            consumer.close();
            shutdownLatch.countDown();
        }
    }

public void shutDown() {
        System.out.println("消费者wakeup");
        consumer.wakeup();
        try {
            shutdownLatch.await();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
```

程序会等待数据操作完成以后调用`consumer.close();`
