今天我们运维同学发现有一台机器上某个进程的CPU使用率经常飙升到100%多。我们起初有怀疑死锁或者是死循环的问题，带着这个疑问我们想办法去定位问题所在。

我们先来看TOP命令的截图
![TOP命令截图](/assets/images/2017-03-18-top.jpeg)

可以看到pid为20758的进程CPU使用率高达243.5%，这是一个kafka的broker进程。

接下来使用`ps -mp pid -o THREAD,tid,time`查看具体是哪个线程暂用的CPU时间最高。我们找到一个线程`root     79.5  19    - -         -      - 20828 27-19:21:46`
最后我们用jstack生成kafka进程的线程信息。`jstack 20758 > kafka.txt`打开生成的线程信息文件通过上面查询出来的**tid**去查询堆栈信息，我从中截取除了对应线程的信息

```shell
Thread 20828: (state = IN_NATIVE)
 - sun.nio.ch.FileDispatcherImpl.pread0(java.io.FileDescriptor, long, int, long) @bci=0 (Compiled frame; information may be imprecise)
 - sun.nio.ch.FileDispatcherImpl.pread(java.io.FileDescriptor, long, int, long) @bci=6, line=52 (Compiled frame)
 - sun.nio.ch.IOUtil.readIntoNativeBuffer(java.io.FileDescriptor, java.nio.ByteBuffer, long, sun.nio.ch.NativeDispatcher) @bci=88, line=220 (Compiled frame)
 - sun.nio.ch.IOUtil.read(java.io.FileDescriptor, java.nio.ByteBuffer, long, sun.nio.ch.NativeDispatcher) @bci=48, line=197 (Compiled frame)
 - sun.nio.ch.FileChannelImpl.readInternal(java.nio.ByteBuffer, long) @bci=121, line=740 (Compiled frame)
 - sun.nio.ch.FileChannelImpl.read(java.nio.ByteBuffer, long) @bci=86, line=726 (Compiled frame)
 - kafka.log.FileMessageSet.readInto(java.nio.ByteBuffer, int) @bci=12, line=286 (Compiled frame)
 - kafka.log.Cleaner.cleanInto(kafka.common.TopicAndPartition, kafka.log.LogSegment, kafka.log.LogSegment, kafka.log.OffsetMap, boolean) @bci=56, line=414 (Compiled frame)
 - kafka.log.Cleaner$$anonfun$cleanSegments$1.apply(kafka.log.LogSegment) @bci=56, line=373 (Interpreted frame)
 - kafka.log.Cleaner$$anonfun$cleanSegments$1.apply(java.lang.Object) @bci=5, line=369 (Interpreted frame)
 - scala.collection.immutable.List.foreach(scala.Function1) @bci=15, line=318 (Compiled frame)
 - kafka.log.Cleaner.cleanSegments(kafka.log.Log, scala.collection.Seq, kafka.log.OffsetMap, long) @bci=234, line=369 (Interpreted frame)
 - kafka.log.Cleaner$$anonfun$clean$4.apply(scala.collection.Seq) @bci=20, line=336 (Interpreted frame)
 - kafka.log.Cleaner$$anonfun$clean$4.apply(java.lang.Object) @bci=5, line=335 (Interpreted frame)
 - scala.collection.immutable.List.foreach(scala.Function1) @bci=15, line=318 (Compiled frame)
 - kafka.log.Cleaner.clean(kafka.log.LogToClean) @bci=234, line=335 (Interpreted frame)
 - kafka.log.LogCleaner$CleanerThread.cleanOrSleep() @bci=99, line=230 (Interpreted frame)
 - kafka.log.LogCleaner$CleanerThread.doWork() @bci=1, line=208 (Interpreted frame)
 - kafka.utils.ShutdownableThread.run() @bci=23, line=63 (Compiled frame)
```

 看上去像是kafka清除log文件有问题，但是由于对kafka的了解有限目前还处于抓瞎状态😂，先记录下来。

*额外补充：当我使用`jstack`查看线程信息的时候提示：`20758: Unable to open socket file: target process not responding or HotSpot VM not loaded`。按照提示我们使用`jstack -f`生成的dump文件，具体的原因还没有找到。*