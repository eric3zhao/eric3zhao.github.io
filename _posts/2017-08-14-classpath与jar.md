#一次打包引发的补漏

##起因

在新项目中我把服务打成jar包去运行。项目中有一些properties文件，如果将这些配置文件都打包进jar文件的话一旦我想修改某个属性就需要重新将代码打包，这样做就相当的麻烦，所以我采用将配置文件都排除在外将代码打成jar包的形式。

##<span id="resolvent">解决办法</span>

具体的打包任务如下（maven方式）：

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-jar-plugin</artifactId>
    <configuration>
        <archive>
            <manifest>
                <!--指定manifest文件中的classpath属性-->
                <addClasspath>true</addClasspath>
                <classpathLayoutType>custom</classpathLayoutType>
                <customClasspathLayout>
                    libs/$${artifact.artifactId}-$${artifact.version}$${dashClassifier?}.$${artifact.extension}
                </customClasspathLayout>
                <!--指定main函数-->
                <mainClass>com.azi.MainTest</mainClass>
            </manifest>
            <manifestEntries>
                <!-- 将当前代码的git commitid 添加到manifest-->
                <Git-Revision>${git.commit.id.describe-short}</Git-Revision>
                <!-- 将本次打包的日期添加到manifest-->
                <Jar-time>${maven.build.timestamp}</Jar-time>
                <!-- 在classpath中添加一个目录，我使用的是resource文件夹 -->
                <Class-path>resources/</Class-path>
            </manifestEntries>
        </archive>
        <excludes>
            <exclude>**/config.properties</exclude>
            <exclude>**/log4j2.xml</exclude>
        </excludes>
    </configuration>
</plugin>
```

##遇到的坑

程序放置的目录结构如下：

```bash
.
├── test.jar
├── config.properties
├── libs
│   ├── ...
│   └── ***.jar
├── log4j2.xml
├── logs
│   └── bugu.log
└── start.sh
```
`config.properties`是程序的配置文件，`log4j2.xml`是log4j2的配置文件，`libs`文件夹下是程序运行所需的依赖包，`start.sh`是程序的启动文件。

###-cp与-jar

一开始我想通过在启动java的时候添加`-cp`或者`-classpath`将程序运行所依赖的jar包和配置文件添加到classpath中，所以我写的启动文件是这样的`nohup java -cp "./:libs/*" -jar test.jar > logs/bugu.log 2>&1 &`运行这个脚本会报错`Exception in thread "main" java.lang.NoClassDefFoundError`程序会应为找不到某个依赖的类而退出运行。这问题让我思考许久，我已经将所有依赖都通过`-cp`参数添加到`classpath`中了但是为什么还不能正常运行？后来我觉得是`-cp`根本没有起作用。

最后我找到了答案[Run a JAR file from the command line and specify classpath](https://stackoverflow.com/questions/18413014/run-a-jar-file-from-the-command-line-and-specify-classpath)在这问题下有提到**"When you specify -jar then the -cp parameter will be ignored."**，同时引用了oracle的官方文档（[java命令说明](http://docs.oracle.com/javase/7/docs/technotes/tools/solaris/java.html#jar)）**"When you use this option, the JAR file is the source of all user classes, and other user class path settings are ignored."**。所以我们知道了`-cp`和`-jar`是不能一起用的也就知道了上面的语句为什么会提示类找不到了，只要把命令改为`nohup java -cp "./:libs/*:test.jar" com.azi.MainTest > logs/bugu.log 2>&1 &`就可以正常运行了。

###jar包中指定classpath

上面的问题已经解决了程序无法运行的问题，但是如上面所说的jar包应该是包含所有的用户class文件的，也就是说是可以通过运行单个jar文件来启动程序的。在查询了资料以后，我了解到在jar包中可以使用**manifest**完成很多事其中就包括指定`classpath`。本项目使用maven作为项目管理工作，最终的打包语句见[解决办法](#resolvent)。下面是gradle的打包语句

```groovy
jar {
    manifest {
        attributes('Main-Class': 'com.bugull.farm.device.server.DeviceServer')
        attributes('Class-Path': configurations.compile.collect { "libs/${it.getName()}" }.join(' ') )
    }
}
```

###如何添加依赖到classpath

在指定`classpath`的过程中我也遇到了问题：

1、刚开始时我直接把配置文件加到`classpath`就是直接用`-cp config.properties`这样的写法，但是在启动程序的时候报错`java.io.FileNotFoundException: class path resource [config.properties] cannot be opened because it does not exist`可见这个配置并没有起作用，**所以我怀疑在添加`classpath`时不能指定具体的文件名，只能到目录级别（仅是怀疑不能确定）**

2、通配符`*`只能用来代替当前目录下的所有`.jar`文件，当上面的写法失败以后我试过将`config.properties`文件放到目录`res`下，然后用`-cp res/*`的方式读取，还是报错。正确的写法是`-cp res`或者`-cp res/`

##写在最后

这次遇到的问题，耗费了我将近一天的时间去解决，当我觉得这问题以后开心之余更多的是觉得还有许多的东西要去学习尤其是基础。有些知识点可能我很早就知道了但是并没有深入了解过，比如这次的classpath的问题，它在我刚开始学习使用java的时候就已经知道有这么一个东西存在，但是并没有深入了解该怎么去使用。所以说“龙生龙。凤生凤，**还是要有好基础**”，以后要在基础上更下功夫才行。
