目前我们的服务都是单向认证的模式（客户端认证服务器的形式）。但是SSL本身是支持双向认证的，所以本文介绍如何自建一个CA证书，并通过自建的CA证书签发不同的客户端证书来实现双向认证。以下的内容都是基于`Java`。

## 签发过程

### 步骤一：创建自定义的CA

商用CA签发证书费用不菲，处于测试的目的我们可以创建一个自己的CA去签发证书。使用`openssl`命令创建：`
openssl req -config /usr/local/etc/openssl/openssl.cnf -new -x509 -keyout ca-key.pem -out ca-certificate.pem -days 365
`根据提示一步步设置就能创建出CA证书`ca-certificate.pem`和CA私钥`ca-key.pem`。`req`命令的`config`是必填项，默认的`openssl.cnf`在`OpenSSL`安装目录下面（*我是`brew`安装的，所以配置文件在`etc`目录下面没有和`bin`文件在一起*）

```shell
Generating a 2048 bit RSA private key
............+++
...................................................+++
writing new private key to '-ca-key.pem'
Enter PEM pass phrase:
Verifying - Enter PEM pass phrase:
-----
You are about to be asked to enter information that will be incorporated
into your certificate request.
What you are about to enter is what is called a Distinguished Name or a DN.
There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.
-----
Country Name (2 letter code) [AU]:CN
State or Province Name (full name) [Some-State]:Zhejiang
Locality Name (eg, city) []:Ningbo
Organization Name (eg, company) [Internet Widgits Pty Ltd]:Azi
Organizational Unit Name (eg, section) []:Development
Common Name (e.g. server FQDN or YOUR name) []:sha zhu lao shi
Email Address []:azizwz@aliyun.com
```

### 步骤二：创建客户端KeyStore

使用`keytool`命令创建Keystroe：`keytool -keystore clientkeystore -genkey -alias client`

```shell
输入密钥库口令:
再次输入新口令:
您的名字与姓氏是什么?
  [Unknown]:  eric zhao
您的组织单位名称是什么?
  [Unknown]:  Development
您的组织名称是什么?
  [Unknown]:  Azi
您所在的城市或区域名称是什么?
  [Unknown]:  Ningbo
您所在的省/市/自治区名称是什么?
  [Unknown]:  Zhejiang
该单位的双字母国家/地区代码是什么?
  [Unknown]:  CN
CN=eric zhao, OU=Development, O=Azi, L=Ningbo, ST=Zhejiang, C=CN是否正确?
  [否]:  是

输入 <client> 的密钥口令
	(如果和密钥库口令相同, 按回车):
```

### 步骤三：创建CSR

基于步骤二创建的`clientkeystore`生成certificate signing request，具体的命令为：`keytool -keystore clientkeystore -certreq -alias client -keyalg rsa -file client.csr`

### 步骤四：使用CA和CSR签发证书

使用步骤一生成的CA文件和步骤三生成的CSR文件签发证书，具体命令为：`openssl x509 -req -CA ca-certificate.pem -CAkey ca-key.pem -in client.csr -out client.cer -days 365 -CAcreateserial`，根据提示输入CA私钥的密码就能签发成功。

```shell
Signature ok
subject=/C=CN/ST=Zhejiang/L=Ningbo/O=Azi/OU=Development/CN=eric zhao
Getting CA Private Key
Enter pass phrase for ca-key.pem:
```

### 步骤五：将CA证书导入KeyStore

使用`keytool`将`client.cer`和`ca-certificate.pem`导入客户端KeyStore。

1.先导入CA证书：`keytool -import -keystore clientkeystore -file ca-certificate.pem -alias theCARoot`

```shell
输入密钥库口令:
所有者: EMAILADDRESS=azizwz@aliyun.com, CN=sha zhu lao shi, OU=Development, O=Azi, L=Ningbo, ST=Zhejiang, C=CN
发布者: EMAILADDRESS=azizwz@aliyun.com, CN=sha zhu lao shi, OU=Development, O=Azi, L=Ningbo, ST=Zhejiang, C=CN
序列号: c9c33326af71a8b8
有效期开始日期: Sat Oct 13 15:34:52 CST 2018, 截止日期: Sun Oct 13 15:34:52 CST 2019
证书指纹:
	 MD5: 02:B2:DB:89:18:A7:59:D6:9A:16:D0:69:24:1A:35:66
	 SHA1: 02:1E:41:EE:EB:C3:C6:63:E9:CF:2C:1B:CB:74:19:14:A6:C9:C6:F0
	 SHA256: 48:C5:2C:48:94:CA:FF:F3:C8:69:AD:EB:07:94:45:08:23:7D:EC:9F:34:4D:B1:0B:B9:B1:19:FD:CD:CA:F5:24
	 签名算法名称: SHA256withRSA
	 版本: 3

扩展:

#1: ObjectId: 2.5.29.35 Criticality=false
AuthorityKeyIdentifier [
KeyIdentifier [
0000: 2B F2 BD 28 1E 34 73 76   C9 21 38 5A 8B 84 02 0B  +..(.4sv.!8Z....
0010: E7 C9 15 9D                                        ....
]
]

#2: ObjectId: 2.5.29.19 Criticality=false
BasicConstraints:[
  CA:true
  PathLen:2147483647
]

#3: ObjectId: 2.5.29.14 Criticality=false
SubjectKeyIdentifier [
KeyIdentifier [
0000: 2B F2 BD 28 1E 34 73 76   C9 21 38 5A 8B 84 02 0B  +..(.4sv.!8Z....
0010: E7 C9 15 9D                                        ....
]
]

是否信任此证书? [否]:  是
证书已添加到密钥库中
```

2.导入签发的证书：`keytool -import -keystore clientkeystore -file client.cer -alias client`

```shell
输入密钥库口令:
证书回复已安装在密钥库中
```
**注意：本步骤中的1、2顺序不能颠倒，不能漏掉1。**

## 如何使用

客户端`SSLEngine `

```java
SSLContext clientContext;
String keyStorePassword = "123456";
try {
    KeyStore ks = KeyStore.getInstance("JKS");
    //读取客户端KeyStore
    ks.load(ClassLoader.getSystemResourceAsStream("clientkeystore"), keyStorePassword.toCharArray());
    KeyManagerFactory kmf = KeyManagerFactory.getInstance("SunX509");
    kmf.init(ks, keyStorePassword.toCharArray());
    clientContext = SSLContext.getInstance("TLS");
    clientContext.init(kmf.getKeyManagers(), null, null);
} catch (Exception e) {
    throw new Error("Failed to initialize SSLContext", e);
}
SSLEngine sslEngine = clientContext.createSSLEngine();
sslEngine.setUseClientMode(Boolean.TRUE);
```
服务器端`SSLEngine `

```java
SSLContext serverContext;
String keyStorePassword = "123456";
try {
    KeyStore ks = KeyStore.getInstance("JKS");
    //读取步服务端KeyStore
    ks.load(ClassLoader.getSystemResourceAsStream("server.jks"), keyStorePassword.toCharArray());
    KeyManagerFactory kmf = KeyManagerFactory.getInstance("SunX509");
    kmf.init(ks, keyStorePassword.toCharArray());
    serverContext = SSLContext.getInstance("TLS");
	//获取信任CA列表
    TrustManagerFactory trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    trustManagerFactory.init(ks);
    TrustManager[] trustManager = trustManagerFactory.getTrustManagers();
    serverContext.init(kmf.getKeyManagers(), trustManager, null);
} catch (Exception e) {
    throw new Error("Failed to initialize SSLContext", e);
}
SSLEngine sslEngine = serverContext.createSSLEngine();
sslEngine.setUseClientMode(Boolean.FALSE);
//激活双向认证，这个很重要，如果不设置为TRUE就不会进行双向认证
sslEngine.setNeedClientAuth(Boolean.TRUE);
```
**注意事项一：服务端必须设置`sslEngine.setNeedClientAuth(Boolean.TRUE)`，只有设置以后在Ssl握手的过程中Server才会发送`Certificate Request`，客户端只在收到`Certificate Request`以后才会发送证书信息给Server**

**注意事项二：服务器端的`server.jks`需要导入自建的CA证书`ca-certificate.pem`，如何导入见先前的文章[SSL证书链的使用](http://eric3zhao.me/SSL证书链的使用/)。因为我用的是公司购买的由GlobalSign签发的证书作为服务器端证书所以不需要将服务器的根证书导入`clientkeystore`，如果读者使用自己创建的KeyStore作为服务器端证书记得将客户端的CA证书导入。**

我使用的netty编写客户端和服务器端。那么如何使用客户端和服务器端的`SSLEngine`呢？只要把`SSLEngine`加入到各自的`pipeline`中就可以了，代码如下：

```java
ChannelInitializer<SocketChannel> channel = new ChannelInitializer<SocketChannel>() {
    protected void initChannel(SocketChannel channel) throws Exception {
        channel.pipeline()
            .addFirst("ssl", new SslHandler(sslEngine))
            .addLast(new MyHandler());
    }
};

```

## 参考连接
[Creating a Sample CA Certificate](https://docs.oracle.com/cd/E19509-01/820-3503/ggeyj/index.html)

[Signing Certificates With Your Own CA](https://docs.oracle.com/cd/E19509-01/820-3503/ggezy/index.html)

[The Transport Layer Security (TLS) Protocol Version 1.2](https://tools.ietf.org/html/rfc5246#section-7.4.1.3)
