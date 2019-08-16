## 简介

最近学习了Spring Cloud相关的内容，在这里简单归纳一下。本篇文章中提到的代码地址[spring-cloud-demo](https://github.com/eric3zhao/spring-cloud-demo)，`spring boot`的版本为`2.1.5.RELEASE`，`spring cloud`的版本为`Greenwich.SR2`

项目的简单结构图如下

![Spring Cloud架构示意](/assets/images/spring cloud demo架构示意.png)

demo中包含如下几个模块:

* **config-server** 项目配置文件，除了自身的配置
* **erueka-server** 注册中心，用于服务发现
* **feign-client** 声明式REST客户端
* **gateway-server** API网关
* **user-provider** 用户服务
* **zuul-server** 路由服务

*题外话：如果对spring应用需要添加哪些依赖感到困惑可以使用这个工具[Spring Initialzr](https://start.spring.io/)*

## Spring-cloud-config

> **Spring Cloud Config Server**

是一个对外提供基于`HTTP`协议的统一资源API的服务（键值对或者等价的YAML）
> **Spring Cloud Config Clinet**

能从`Config Server`获取配置的服务，demo中的`erueka-server`,`feign-client`,`gateway-server`,`user-provider`,`zuul-server`都是`config client`

### config-server

1. 创建一个`config-server`项目很简单，如果你的项目使用maven，只需要添加一个依赖就可以了

	```xml
	<dependency>
		<groupId>org.springframework.cloud</groupId>
		<artifactId>spring-cloud-config-server</artifactId>
	</dependency>
	```

2. 编写启动类，注意需要使用`@EnableConfigServer`注解

	```java
	@SpringBootApplication
	@EnableConfigServer
	public class ConfigServer {
		public static void main(String[] args) {
			SpringApplication.run(ConfigServer.class, args);
    	}
	}
	```
	
3.	编写配置文件，配置文件中主要是指定文件管理的地址，这里我们使用git作为文件的管理工具

	```yaml
	server:
	 port: 8080
	spring:
	 cloud:
	  config:
	   server:
	    git:
	     uri: https://github.com/eric3zhao/azi-config-repo.git
	```
4.	启动服务，并访问[http://127.0.0.1:8080/sample/dubbo](http://127.0.0.1:8080/sample/dubbo)，服务将会以json的格式返回对应服务的配置，如下图所示
	![config server](/assets/images/spring-cloud-config.png)

### config-client

创建一个config client也很方便，只要添加如下依赖就可以了

```xml
<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-config</artifactId>
</dependency>
```
这里用demo中的`user-provider`做例子。如上面所述我们加入`spring-cloud-starter-config`依赖以后，服务自动就成为了一个config client，但是client是如何知道server的位置，以及自身需要哪些配置文件的呢？这里就需要引入一个特殊的配置文件`bootstrap.yml`，下面结合`user-provider`的配置简单说一下如何配置一个config client	

```yaml
spring:
  profiles:
    active:
      - dev
  application:
    name: user-provider
  cloud:
    config:
      uri: http://127.0.0.1:8080
```
可以看到我们通过`spring.cloud.config.uri`这个属性设置config server的地址，而`spring.application.name`和`spring.profiles.active`两个属性决定了需要获取的配置文件名，在这个例子中客户端将会向服务器获取`user-provider.yml`和`user-provider-dev.yml`两个文件

### 遇到的问题

在demo中我们使用github作为配置文件的仓库，在使用的中遇到了一个问题，也可能是`Spring Cloud Config`的默认实现。首先我们将`spring.cloud.config.uri`设置为本地git仓库比如`file://${user.home}/Github/spring-config-repo`，当我们在本地的git仓库提交了一个新的配置文件比如`user-provider.yml`但是还没有push到远程仓库

```bash
commit 4688f09da1a2aa4a91f2823b88cd2624da710a45 (HEAD -> master)
Author: 杀猪老师 <eric3wade@gmail.com>
Date:   Wed Jul 31 14:44:19 2019 +0800

    用户模块配置文件

commit 846eed6b0c3cfd6197e5e02d87ca5e9ecf869a21 (origin/master)
Author: 杀猪老师 <eric3wade@gmail.com>
Date:   Wed Jul 31 14:07:04 2019 +0800

    添加eureka的配置文件
```
这时启动`config server`会看到如下的提示

```
WARN 34146 --- [nio-8090-exec-1] pClientConfigurableHttpConnectionFactory : No custom http config found for URL: https://github.com/eric3zhao/azi-config-repo.git/info/refs?service=git-upload-pack
WARN 34146 --- [nio-8090-exec-1] .c.s.e.MultipleJGitEnvironmentRepository : The local repository is dirty or ahead of origin. Resetting it to origin/master.
INFO 34146 --- [nio-8090-exec-1] .c.s.e.MultipleJGitEnvironmentRepository : Reset label master to version AnyObjectId[846eed6b0c3cfd6197e5e02d87ca5e9ecf869a21]

```
可以看到本地仓库被回退到和远程仓库一致的版本。

## Spring-Cloud-Netflix-Eureka

> **Eureka Server**

服务注册中心

> **Eureka Client**

eureka客户端，同时也是一个服务，比如demo中的`user-provider`注册到`eureka-server`的同时自身是一个REST服务

### eureka-server

1. 创建一个`eureka-server`项目同样简单，只要引入`spring-cloud-starter-netflix-eureka-server`就可以了

	```xml
	<dependency>
		<groupId>org.springframework.cloud</groupId>
		<artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
	</dependency>
	```
2. 编写启动类，并添加`@EnableEurekaServer`注解
	
	```java
	@SpringBootApplication
	@EnableEurekaServer
	public class EurekaServer {
		public static void main(String[] args) {
			SpringApplication.run(EurekaServer.class, args);
		}
	}
	```
3.	编写配置文件，这里我们使用8761作为服务的端口（8761是默认eureka默认端口）
	
	```yaml
	server:
	 port: 8761
	eureka:
	 client:
	  registerWithEureka: false
	  fetchRegistry: false
	```
4. 启动服务。eureka会提供一个[dashboard](http://localhost:8761/)，上面会显示服务的状态

### eureka-client

创建一个eureka-client项目同样简单，只需要在依赖中添加

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```
继续使用`user-provider`作为例子。通常我们需要添加注释`@EnableDiscoveryClient`或者`@EnableEurekaClient`但是如果我们的`classpath`包含`spring-cloud-starter-netflix-eureka-client`依赖，则上面两个注解可以不写。当然配置中需要指定`eureka server`的地址，可参考下面的配置文件

```yaml
spring:
  application:
    name: user-provider
server:
  port: 0
eureka:
  client:
    serviceUrl:
      defaultZone: http://localhost:8761/eureka
  instance:
    preferIpAddress: true
```
服务启动以后`user-provider`会将自己作为一个客户端将自身注册到`eureka server`

## Srping-Cloud-OpenFeign

Feign是一个声明式的web服务客户端，它使得开发一个web服务客户端更加简单。前面我们已经搭建好了`user-provider`服务，现在我们看`feign-client`如何调用user服务。

1. 创建一个Feign应用同样简单，只需要在依赖中引入

	```xml
	<dependency>
	    <groupId>org.springframework.cloud</groupId>
	    <artifactId>spring-cloud-starter-openfeign</artifactId>
	</dependency>
	```
	
2.	编写启动类，这里使用`@EnableFeignClients`注解

	```java
	@SpringBootApplication
	@EnableFeignClients
	public class FeignApplication {
	    public static void main(String[] args) {
	        SpringApplication.run(FeignApplication.class, args);
	    }
	}
	```
3. 编写配置文件，文件中我们指定`eureka server`的地址，这样Feign应用可以通过eureka获取可用的user服务

	```yaml
	spring:
	  application:
	    name: feign-client
	server:
	  port: 8081
	eureka:
	  client:
	    serviceUrl:
	      defaultZone: http://localhost:8761/eureka
	  instance:
	    preferIpAddress: true
	```
	
4. 编写一个`FeignClient`接口

	```java
	@FeignClient("user-provider")
	public interface UserApiCaller {
	    @RequestMapping("/hello")
	    String callHello();
	}
	```
	
5. 为了方便调试，我们写一个REST接口`/nihao`，在nihao方法中我们调用`UserApiCaller`的`callHello`方法

	```java
	@RestController
	@RequestMapping("/user")
	public class TestController {
	    @Autowired
	    private UserApiCaller userApiCaller;
	
	    @RequestMapping("/nihao")
	    public String nihao() {
	        return userApiCaller.callHello();
	    }
	}
	```
6. 启动服务以后，访问[http://localhost:8081/user/nihao](http://localhost:8081/user/nihao)，Feign应用将会调用user服务的hello接口

## Eage Server

在demo中我把`zuul-server`和`gateway-server`称为`edge server`，下面简单说说这两个服务

### Spring-Cloud-Netflix-Zuul

1.	在项目中引入zuul依赖

	```xml
	<dependency>
	    <groupId>org.springframework.cloud</groupId>
	    <artifactId>spring-cloud-starter-netflix-zuul</artifactId>
	</dependency>
	```
2.	编写启动类，这里使用`@EnableZuulProxy`注解

	```java
	@SpringBootApplication
	@EnableZuulProxy
	public class ZuulServer {
	    public static void main(String[] args) {
	        SpringApplication.run(ZuulServer.class, args);
	    }
	}
	```
3. 编写配置文件，在配置中`zuul`作为一个client连接到eureka，方便后续获取user服务。可以看到在路由规则中指定所有以`/user`开头的接口都被指派调用user服务处理

	```yaml
	spring:
	  application:
	    name: zuul-server
	server:
	  port: 8082
	eureka:
	  client:
	    serviceUrl:
	      defaultZone: http://localhost:8761/eureka
	  instance:
	    preferIpAddress: true
	zuul:
	  routes:
	    user:
	      path: /user/**
	      serviceId: user-provider
	      stripPrefix: true
	```
4. 启动服务以后访问[http://localhost:8082/user/hello](http://localhost:8082/user/hello)，最终会调用user服务的hello的接口

### Spring-Cloud-Gateway

1.	在项目中引入Gateway的依赖

	```xml
	<dependency>
	    <groupId>org.springframework.cloud</groupId>
	    <artifactId>spring-cloud-starter-gateway</artifactId>
	</dependency>
	```
	
2. 编写启动类

	```java
	@SpringBootApplication
	public class GatewayServer {
	    public static void main(String[] args) {
	        SpringApplication.run(GatewayServer.class, args);
	    }
	}
	```
3. 配置规则，同样的gateway服务从eureka中获取user服务。可以看到路由规则会将所有`/user`开头的请求转发到user服务

	```yaml
	server:
	  port: 8081
	eureka:
	  client:
	    serviceUrl:
	      defaultZone: http://localhost:8761/eureka
	  instance:
	    preferIpAddress: true
	spring:
	  application:
	    name: gateway-server
	  cloud:
	    gateway:
	      routes:
	        - id: path_router
	          uri: lb://user-provider
	          predicates:
	            - Path=/user/**
	          filters:
	            - StripPrefix=1
	```
4. 启动服务以后访问[http://localhost:8081/user/hello](http://localhost:8081/user/hello)，最终会调用user服务的hello接口

## 写在最后

这篇文章只是简单的学习一下Spring Cloud的部分组件，还有好多有用的组件没有涉及比如`Robbin`,`Hystrix`等。不得不说`Spring Cloud`是一个庞大的项目，但是也大大简化了开发工作，整片文章下来可以发现每个模块的搭建非常简单往往引入几个依赖代码中添加几个注解，服务就能正常运行，所以开发者可以把更多的精力放到业务逻辑上。