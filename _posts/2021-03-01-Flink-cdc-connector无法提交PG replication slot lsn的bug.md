最近打算将Flink应到的公司的项目中。主要是应用于ODS数据打宽写入DWD的功能中，我们底层的数据库使用的是阿里云的RDS PostgreSQL，我们的Flink使用的也是阿里云的产品，在实践中我发现，在Flink的作业启动并运行一段时间（两周左右）以后PG数据库的磁盘就耗尽了，通过阿里云的后台我发现PG数据库的数据空间使用量在10G左右，但是WAL空间的使用量达到了90多G，这两项加起来超过我们购买的100G的总使用空间，导致PG数据直接无法进行任何操作，最终通过升级磁盘后重启数据库解决。

## 问题分析

在PG社区寻求帮助以后我找到了两篇文章[PostgreSQL WAL 文件数量长期持续增加问题排查](https://mp.weixin.qq.com/s/UeHykDusPJIrwEWHcrOpKw)和 [PostgreSQL 逻辑复制异常引发Pg_wal目录膨胀一例](https://mp.weixin.qq.com/s/aZ2NyPYFvF5L8UUEy1lZGw)。在我的场景中我发现，虽然我的复制槽处于激活状态`active = t`，但是`restart_lsn`和`confirmed_flush_lsn`这两项并不会随着时间发生变化，也就是说这两个值永远是我启动Flink的作业时创建slot所使用的值。这也就解释了为啥WAL文件占用的磁盘空间不停的增长，因为Flink不会再数据同步完以后更新对应的PG replication slot中的lsn，从而导致lsn所对应的WAL文件无法被回收。

在知道了问题的成因以后我将这个bug告知了阿里方面，但是当时他们短时间没有人力修复，作为一个开发不能永远都做一个伸手党，也应该积极的参与到开源社区中，所以我打算自己修复这个bug。

## 我的修复方案

首先我发现flink-cdc-connector使用[Debezium Engine](https://debezium.io/documentation/reference/1.4/development/engine.html)作为底层的数据抽取功能，具体的代码

```java
// create the engine with this configuration ...
this.engine = DebeziumEngine.create(Connect.class)
	.using(properties)
	.notifying(debeziumConsumer)
	.using((success, message, error) -> {
		if (!success && error != null) {
			his.reportError(error);
		}
	})
	.build();

if (!running) {
	return;
}

// run the engine asynchronously
executor.execute(engine);
```

在上面代码的核心逻辑如下

1. 通过`DebeziumEngine#create`创建一个`builder`（建造者模式），在组装完builder的属性以后调用`Builder#build`创建一个匿名类（DebeziumEngine类型），并将该匿名类的实例对象赋值给`this.engine`。注意在这个匿名类的实例中有一个`EmbeddedEngine`类型的实例属性，我们可以把这个属性看作是一个`delegate`，也就是说所有的逻辑都写在`EmbeddedEngine`中

2. 通过`Executor#execute`异步执行`this.engine`（DebeziumEngine的定义中实现了Runnable接口）的逻辑，上面提到了`EmbeddedEngine`对象才是最总执行具体逻辑的，所以我们只要看`EmbeddedEngine#run`就可以了

3. `EmbeddedEngine#run`的逻辑比较复杂，这里我们看关键的部分：

    3.1 创建`SourceTask`实例，这里我们使用的是`PostgresConnectorTask`类型

    3.2 调用`SourceTask#start`这个函数具体实现在`BaseSourceTask#start`中，而这个函数会调用另外一个抽象的`start`函数`this.coordinator = start(config);`而这个函数的实现又各有不同，我们用的是`PostgresConnectorTask`类型

    3.3 在`PostgresConnectorTask#start`中将会完成PG数据库链接的初始化，并创建一个`replication slot`用于后续的数据同步，最后返回一个`ChangeEventSourceCoordinator`的实例

    3.4 在上一步返回之前会调用`ChangeEventSourceCoordinator#start`，在这个函数中会提交一个异步的任务，这个任务会先对数据库做snapshot就是将历史数据同步到下游，然后再进行流式的数据同步（通过死循环不停的读取数据）然后发送到下游

4. 使用`SourceTask#poll`函数获取上一步`ChangeEventSourceCoordinator`实例发送到下游的数据记录（死循环方式）

5. 将上一步收到的数据提交给`DebeziumEngine.ChangeConsumer#handleBatch`处理，`ChangeConsumer`的具体实例就是在上面Java代码中的`debeziumConsumer`，而`debeziumConsumer`的类型是`DebeziumChangeConsumer`该类定义在flink-cdc-connector中

所以简单来说就是`PostgresConnectorTask`（属于Debezium）从数据库抽取数据交给`DebeziumChangeConsumer`（属于flink-cdc-connector）处理，`DebeziumChangeConsumer`会将收到的数据由`SourceRecord`(Debezium)转成`GenericRowData`（Flink）以后再丢给Flink进行后续的流处理

那么我们应该在哪一步将处理完的数据的lsn值回写到PG数据库中呢？在默认的Debezium中是这样实现的：

收到数据后并处理以后直接提交，通过在`handleBatch`函数中调用`RecordCommitter#markBatchFinished`

但是如果数据库的数据数据长时间没有修改的话就不会触发上面的提交，所以在上述的基础上设置`heartbeat.interval​.ms`参数，每当满足心跳时会创建一个虚拟的记录（只有lsn信息没有实际的数据内容）来提交lsn。

那么当Debezium和Flink结合时就不能单纯依靠上述逻辑去提交lsn了，原因就是Flink靠的是checkpoint去做容错的，那么提交lsn必须是checkpoint完成以后去做，否者可能会导致checkpoint中保存的start lsn与WAL中存在的最早的offset对不上从而导致数据丢失

到了现在我们明确应该何时提交lsn到PG数据库，剩下的就是怎么去做了，上面提到过`RecordCommitter#markBatchFinished`函数会提交lsn，通过跟踪源代码可以看到最终调用的是`ChangeEventSourceCoordinator#commitOffset`函数，那么我获取到`PostgresConnectorTask`实例中的`ChangeEventSourceCoordinator`属性（Debezium核心逻辑3.3）是不是就可以调用这个方法了？

接下来的方法就比较hack了。查看源代码可以看到在`DebeziumSourceFunction`实例中保存了`engine`属性，但是`DebeziumEngine`并没有获取内在task的函数，所以我通过Java的反射机制去做了，代码大概是这样的

```java
Class<?> anonymousEngine = engine.getClass();
//获取DebeziumEngine匿名类实例
Field[] anonymousEngineFields = anonymousEngine.getDeclaredFields();
Object delegate = null;
try {
	for (Field field : anonymousEngineFields) {
		field.setAccessible(true);
		Object f = field.get(engine);
        //获取匿名类实例中的EmbeddedEngine对象
		if (f instanceof DebeziumEngine) {
			delegate = f;
			break;
		}
	}
    if (Objects.isNull(delegate)) {
		return;
	}
    //获取EmbeddedEngine对象中的PostgresConnectorTask对象
	Field taskField = EmbeddedEngine.class.getDeclaredField("task");
	taskField.setAccessible(true);
	Object sourceTask = taskField.get(delegate);
	if (Objects.nonNull(sourceTask)) {
        //获取PostgresConnectorTask对象中的ChangeEventSourceCoordinator对象
	    BaseSourceTask baseSourceTask = (BaseSourceTask) sourceTask;
	    Field coordinatorField = BaseSourceTask.class.getDeclaredField("coordinator");
	    coordinatorField.setAccessible(true);
	    Object coordinatorObj = coordinatorField.get(baseSourceTask);
	    if (Objects.nonNull(coordinatorObj)) {
		    return (ChangeEventSourceCoordinator) coordinatorObj;
		}
	}
}
```

从上面的代码获取到的`ChangeEventSourceCoordinator`实例，然后在flink创建checkpoint文件的函数`snapshotState`中调用`ChangeEventSourceCoordinator#commitOffset`将lsn提交到PG数据库中

## 官方修复方案

在我提交我的PR到github上以后，在阿里官方review以后表示有几个问题：

1. 获取`ChangeEventSourceCoordinator`的方式过于hack
2. `snapshotState`函数其实是写入checkpoint，并非完成checkpoint，所以可能存在checkpoint写入失败的问题
3. 没做单元测试

有兴趣的可以去看[PR](https://github.com/ververica/flink-cdc-connectors/pull/107)

那么官方是如何修复这个bug的呢？
1. 对于问题1，其实在Debezium的概念中我提到过`RecordCommitter#markBatchFinished`是用来提交数据用的，而`DebeziumChangeConsumer#handleBatch`函数被调用时第二个参数就是`RecordCommitter`类型，所以我们可以在`DebeziumChangeConsumer`类中添加一个`DebeziumEngine.RecordCommitter`类型的属性`currentCommitter`，然后在`handleBatch`函数中将传入的参数值赋值给`currentCommitter`，最后写一个提交lsn的函数，在该函数里调用`currentCommitter#markBatchFinished`就能正常提交lsn了。对于这点我在修复时过于执着于获取`ChangeEventSourceCoordinator`实例而忽略了`RecordCommitter`的存在

2. 对于问题2，我们不应在`CheckpointedFunction#snapshotState`中提交lsn而是应该用`CheckpointListener#notifyCheckpointComplete`。对于这一地是因为对Flink不够了解，根本不清楚有这功能

## 写在最后

到此这个bug已经被修复，希望该修复能尽快应用到阿里的Flink产品中