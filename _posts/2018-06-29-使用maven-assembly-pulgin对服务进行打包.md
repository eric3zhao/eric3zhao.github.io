## 起源

在项目开发过程中需要将服务整个打包发布到服务器，所以在很早之前我就想用maven的assembly写一个将所有文件打包成zip包，方便后续的上传和启动服务，最近刚好在写一个新的项目就将这想法付诸实践。顺带好久没写博客了更新一波。

## 实现

maven自带的[assembly](http://maven.apache.org/plugins/maven-assembly-plugin/)插件就可以实现我们的需求。具体的写法如下所示：

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-assembly-plugin</artifactId>
    <executions>
        <execution>
            <id>azi-assemble</id>
            <phase>package</phase><!-- 绑定到package生命周期上 -->
            <goals>
                <goal>single</goal>
            </goals>
        </execution>
    </executions>
    <configuration>
        <descriptors>${project.basedir}/assembly.xml</descriptors><!--配置描述文件路径-->
    </configuration>
</plugin>
```

对assembly.xml的讲解结合程序具体的目录结构进行讲解，服务程序包分为四个子目录。
1. bin：启动停止脚本。
2. config：配置文件。
3. libs：运行所需的所有jar包。
4. log：日志。

```
.
├── bin
│   ├── start.sh
│   └── stop.sh
├── config
│   ├── log4j2.xml
│   └── *.properties
├── libs
│   ├── ...
│   └── ***.jar
├── logs
│   └── server.log
```

相应的assembly脚本如下：

```xml
<assembly xmlns="http://maven.apache.org/ASSEMBLY/2.0.0"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://maven.apache.org/ASSEMBLY/2.0.0
        http://maven.apache.org/xsd/assembly-2.0.0.xsd">
    <formats>
        <format>zip</format><!-- 打包成zip包 -->
    </formats>
    <includeBaseDirectory>true</includeBaseDirectory>
    <dependencySets>
        <dependencySet><!-- 将运行时依赖包拷贝到libs目录 -->
            <useProjectArtifact>true</useProjectArtifact>
            <outputDirectory>libs</outputDirectory>
            <scope>runtime</scope>
        </dependencySet>
    </dependencySets>
    <fileSets>
        <fileSet>
            <directory>src/main/resources</directory>
            <outputDirectory>config</outputDirectory>
        </fileSet>
        <fileSet> <!-- 创建一个空的logs目录 -->
            <outputDirectory>logs</outputDirectory>
            <excludes><exclude>**/*</exclude></excludes>
        </fileSet>
        <fileSet> <!-- bin目录下的文件都为可执行 -->
            <directory>src/main/bin</directory>
            <outputDirectory>bin</outputDirectory>
            <fileMode>700</fileMode>
        </fileSet>
    </fileSets>
</assembly>
```

我们在运行`maven packge`以后会生成一个`${project.artifactId}.zip`文件，将包文件上传到服务器解压然后运行`start.sh`就能启动服务了。

## 写在最后

服务打包的事情拖了好久最近才着手去做，下一步打算结合jenkins来实现测试环境的CI。