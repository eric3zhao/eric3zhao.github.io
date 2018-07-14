## 起源

最近的新项目打算使用`spring boot+dubbo+mybatis+druid`的组合实现微服务。不论是`spring`、`dubbo`、`druid`还是`mybatis`在别的项目都有用到，但是所有的配置都是以`xml`的形式存在的，这个一点也不符合`spring boot`的腔调，所以花了一天时间把几个重新整合了一下。所有的代码都在[demo](https://github.com/eric3zhao/dubbo-spring-boot-demo)中。

## 实现

这里我们使用maven来构建项目。我们知道使用`Starters`很容易就能将`spring boot`相关的依赖包引入进来，比如我们想穿件一个web项目只要直接在`pom.xml`里面加入`spring-boot-starter-web`就能轻松构建一个web项目

```xml
<dependency>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-web</artifactId>
	<version>${spring-boot.version}</version>
</dependency>
```

所以我们只要将对应框架的`Spring Starter`添加到`pom.xml`里面，相应的依赖包就很自然的添加到项目中了（很高兴，我们用到的几个框架都有对应的`Starter`），这里我们贴出几个框架的`Starter`，有兴趣的同学可以去对应的官网学习。

[Mybatis Starter](http://www.mybatis.org/spring-boot-starter/mybatis-spring-boot-autoconfigure/index.html)

```xml
<dependency>
    <groupId>org.mybatis.spring.boot</groupId>
    <artifactId>mybatis-spring-boot-starter</artifactId>
    <version>1.3.2</version>
</dependency>
```

[Alibaba Druid Starter](https://github.com/alibaba/druid/tree/master/druid-spring-boot-starter)

```xml
<dependency>
   <groupId>com.alibaba</groupId>
   <artifactId>druid-spring-boot-starter</artifactId>
   <version>1.1.10</version>
</dependency>
```

[Apache Dubbo Starter](https://github.com/apache/incubator-dubbo-spring-boot-project)

```xml
<dependency>
    <groupId>com.alibaba.boot</groupId>
    <artifactId>dubbo-spring-boot-starter</artifactId>
    <version>0.2.0</version>
</dependency>
```
我们只要把这三个依赖添加到`pom.xml`中就能直接进行开发了，非常之方便。最后我想特别的提一点，如果读者使用我提供的demo可能会发现我在`demo-impl(Provider)`这个模块里面关于`spring-boot-starter`做了处理，将`logging starter`剔除了，转而使用`log4j2`作为日志输出，原因就是`spring`默认使用`slf4j+logback`作为日志输出的框架，而我比较熟悉`slf4j+log4j2`的组合仅此而已。

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter</artifactId>
    <version>2.0.3.RELEASE</version>
    <exclusions>
         <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-logging</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-log4j2</artifactId>
   <version>2.0.3.RELEASE</version>
</dependency>
```


##附录

demo项目的文件结构如下

```
dubbo-spring-boot-demo
├── demo-api
│   ├── pom.xml
│   └── src
│       ├── main
│       │   ├── java
│       │   └── resources
│       └── test
│           └── java
├── demo-impl
│   ├── pom.xml
│   └── src
│       ├── main
│       │   ├── bin
│       │   │   ├── start.sh
│       │   │   └── stop.sh
│       │   ├── java
│       │   └── resources
│       │       ├── application.yml
│       │       ├── log4j2.xml
│       │       └── mybatis
│       │           └── Test.xml
│       └── test
│           └── java
├── demo-web
│   ├── pom.xml
│   └── src
│       ├── main
│       │   ├── java
│       │   └── resources
│       │       └── application.yml
│       └── test
│           └── java
└── pom.xml
```