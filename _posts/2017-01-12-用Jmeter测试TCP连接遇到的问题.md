最近想通过Jmeter测试socket服务的性能，如何配置一个TCP的采样器网上已经有很多的教程了，就不赘述了，这里我讲讲我遇到的一个问题。
Jmeter默认发送TCP数据采用的是文本数据（TCPClientImpl），但是我需要的是16进制的数据，在Jmeter的Javadoc里面TCP协议的Client实现有三种：
* TCPClientImpl：文本数据，默认为这种
* BinaryTCPClientImpl：传输16进制数据，可以指定包结束符
* LengthPrefixedBinaryTCPClientImpl：数据包中前2个字节为数据长度
我采用BinaryTCPClientImpl类型的。但是在运行中发现我设置了两次循环但是执行卡住了只能主动的去停止执行或者等待超时，当我中断任务以后在结果树中发现所有的请求都response code:500

![截图1](/assets/images/6083BA4E-CA4A-4821-AD02-B2D637DF0AED.png)
我在jmeter.log中截取了完整的报错信息

```java
2017/01/12 10:37:07 ERROR - jmeter.protocol.tcp.sampler.TCPSampler:  org.apache.jmeter.protocol.tcp.sampler.ReadException: 
	at org.apache.jmeter.protocol.tcp.sampler.BinaryTCPClientImpl.read(BinaryTCPClientImpl.java:140)
	at org.apache.jmeter.protocol.tcp.sampler.TCPSampler.sample(TCPSampler.java:415)
	at org.apache.jmeter.threads.JMeterThread.executeSamplePackage(JMeterThread.java:465)
	at org.apache.jmeter.threads.JMeterThread.processSampler(JMeterThread.java:410)
	at org.apache.jmeter.threads.JMeterThread.run(JMeterThread.java:241)
	at java.lang.Thread.run(Thread.java:745)
Caused by: java.net.SocketException: Socket closed
	at java.net.SocketInputStream.socketRead0(Native Method)
	at java.net.SocketInputStream.socketRead(SocketInputStream.java:116)
	at java.net.SocketInputStream.read(SocketInputStream.java:170)
	at java.net.SocketInputStream.read(SocketInputStream.java:141)
	at java.net.SocketInputStream.read(SocketInputStream.java:127)
	at org.apache.jmeter.protocol.tcp.sampler.BinaryTCPClientImpl.read(BinaryTCPClientImpl.java:126)
	... 5 more
```

然后看了源代码

```java
@Override
    public String read(InputStream is) throws ReadException {
        ByteArrayOutputStream w = new ByteArrayOutputStream();
        try {
            byte[] buffer = new byte[4096];
            int x = 0;
            while ((x = is.read(buffer)) > -1) {
                w.write(buffer, 0, x);
                if (useEolByte && (buffer[x - 1] == eolByte)) {
                    break;
                }
            }
            IOUtils.closeQuietly(w); // For completeness
            final String hexString = JOrphanUtils.baToHexString(w.toByteArray());
            if(log.isDebugEnabled()) {
                log.debug("Read: " + w.size() + "\n" + hexString);
            }
            return hexString;
        } catch (IOException e) {
            throw new ReadException("", e, JOrphanUtils.baToHexString(w.toByteArray()));
        }
    }
```

看上去是没收倒是EolByte，以这个为出发点我在Stack Overflow里面找到一个问答[JMeter TCP Sampler incorrectly reports 500](http://stackoverflow.com/questions/10683853/jmeter-tcp-sampler-incorrectly-reports-500)，里面提到设置EolByte能解决问题，根据以上的信息我在TCP取样器的设置里面找到了EOL，在我的例子中返回的数据中最后的的byte是0x78转换为十进制的数字是120，所以我们填120
![截图2](/assets/images/8533FE56-7E90-49DA-A573-8A17B64A27A1.png)
最后我们在运行一遍就能得到想要的结果了

