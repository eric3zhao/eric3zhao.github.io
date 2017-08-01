# Netty中的AttributeMap
在项目的开发中遇到一个问题：当一个连接创建以后，为了确保后续的业务逻辑处理能顺利进行，可能需要将channel的信息与连接所属的实际设备相管理。以前我们处理这个问题所采取的办法获取channelId：`String channelid = ctx.channel().id().asLongText()`和设备的唯一识别标志uuid（*e.g.设备的MAC地址，设备的SN码，GPRS设备的CCID，IMEI号*）,将channelId和uuid添加到一个Map中`Map.put(channelId,uuid)`。这样做带来的额外工作就是每当一个连接断开时需要在`channelInActive`中添加`Map.remove(channelId)`,另外在netty本身的多线程模型下Map的线程安全也是需要考虑的一个点。所以，我一直在寻求更好的解决方案，直到我从《netty in action》中看到本篇文章的主角`AttributeMap`。下面我将举一个简单的例子：运用`AttributeMap`来校验连接的合法性的。

**编写一个常量类保存常量**

```java
public class FarmConstant {
	priavte FarmConstant(){}
	
   public static final AttributeKey<String> CHANNEL_MAC_ADDRESS = AttributeKey.valueOf("channel.mac.address");
}
```

**编写一个ChannelStatusHandler来处理连接接入与断开的逻辑**

如下代码所示如果连接创建10秒钟以后还未进行登录操作则直接关闭连接

```java
public class ChannelStatusHandler extends ChannelHandlerAdapter {

    @Override
    public void channelInactive(ChannelHandlerContext ctx) throws Exception {
    	//do something
    }

    @Override
    public void channelActive(final ChannelHandlerContext ctx) throws Exception {
        //if there is no join operation after the connection succeed for 10 seconds , then disconnect the connection
        ctx.channel().eventLoop().schedule(new Runnable() {

            @Override
            public void run() {
                String mac = ctx.channel().attr(FarmConstant.CHANNEL_MAC_ADDRESS).get();
                if (mac == null || s.trim().length() == 0) {
                    ctx.channel().close();
                }
            }

        }, 10, TimeUnit.SECONDS);
    }
}
```
**编写一个LoginHandler来处理登录逻辑**

在本例中我使用设备的MAC地址作为设备的唯一识别码

```java
public class LoginHandler extends SimpleChannelInboundHandler<ByteBuf> {
    
    @Override
    protected void messageReceived(ChannelHandlerContext ctx, ByteBuf msg) throws Exception {
    	//log in 
    	ctx.channel().attr(FarmConstant.CHANNEL_MAC_ADDRESS).set(macString);
    }

}
```
### 后记
netty的attribute可以用到许多方面，比如开头提到的标识连接与终端设备的关系。另外在我的实践中还有一个有趣的用途，很多的通信设备由于硬件方面的限制可能无法实现TLS加密通信。但是为了数据的安全有需要用到加密通信，这种情况我往往使用AES加密，加密通信有个很重要的东西就是密钥，对的，我就是用attribute去保存各个channel的KEY。由于对安全这一块了解的不多，觉得有问题的同学欢迎指正。


