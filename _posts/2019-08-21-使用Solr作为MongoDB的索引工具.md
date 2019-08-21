本文主要介绍如何使用**[Mongo Connector](https://github.com/yougov/mongo-connector)**对`MongoDB`的某个`collection`建立基于`Solr`的索引。本文涉及的工具以及本版

* Java 1.8.0_221
* Python 3.6.8
* MongoDB 4.2
* Apache Solr 8.2.0
* Mongo Connector 3.1.1

## 准备工作

### MongoDB

下载安装`MongoDB`的步骤不再赘述，可以参考[官方手册](https://docs.mongodb.com/manual/administration/install-community/)。在实践的过程中需要注意`Mongo Connector`只支持`replica set`模式，如何设置同样可以参考[官方手册](https://docs.mongodb.com/manual/tutorial/deploy-replica-set/)。

### Apache Solr

本文使用的`Solr`版本是`8.2.0`需要`Java`的版本大于1.8。`Solr`的安装很简单，直接下载最新的版本并解压就可以使用[Solr Downloads](http://lucene.apache.org/solr/downloads.html)

### Mongo Connector

本文使用的`Mongo Connector`版本是3.1.1需要`Python`的版本大于3.4，`MongoDB`的版本大于3.4。使用`pip`安装`sudo pip install 'mongo-connector[solr]'`

## 详细步骤

### 创建一个`Solr Core`

首先进入`Solr`的安装目录，比如我`Solr`安装在用户的`home`目录则详细地址是`~/solr-8.2.0/bin`。然后运行

```shell
./solr create -c test
```
成功以后我们就能在`Solr`的管理界面看到创建成功的`Core`

![Solr Core Admin](/assets/image/solr-core.png)

创建`Core`也可以在`Solr`的管理界面完成

### 修改`Core`的配置

在上图中可以看到test实例所在的目录是`instanceDir:/home/eric/solr-8.2.0/server/solr/test`，进入该目录可以看到在`config`文件夹下面有两个文件`managed-schema`和`solrconfig.xml`。
> solrconfig.xml

在solrconfig.xml确保有这一行内容，如果没有请加上

```xml
<requestHandler name="/admin/luke" class="org.apache.solr.handler.admin.LukeRequestHandler" />
```

> managed-schema

可能大家在别的文章看到是需要修改`schema.xml`这个文件，但是高版本的`Solr`不会自动生成这个文件，我们可以直接把`managed-schema`文件重命名为`schema.xml`然后添加你想要`Field`，比如我想对`content`列做索引就添加如下内容

```xml
<field name="content" type="string" indexed="true"  stored="true"  multiValued="false" />
```

由于`Mongo Connector`不支持`Solr`的`schemaless`模式。所以只会对指定的`filed`的索引，如果觉得修改文件不方便，也可以在`Solr`管理界面中修改`schema`的内容

`MongoDB`通常使用`_id`作为文档的唯一key但是在`Solr`中默认使用`id`，所以我们可以在`schema.xml`中将下面这一行

```xml
<uniqueKey>id</uniqueKey>
```

改为

```xml
<uniqueKey>_id</uniqueKey>
```

同时不要忘了添加一个名为`_id`的field，或者你可以直接将原来的`id`修改

```xml
<field name="_id" type="string" indexed="true" stored="true" />
```

修改完以上配置以后重启`Solr`

### 启动`Mongo Connector`

下面是我启动的语句，大家可以根据自己的情况修改配置

```shell
mongo-connector --auto-commit-interval=0 -n azi.test -a root -p 123456 -m 127.0.0.1:27017 -t http://127.0.0.1:8983/solr/test -d solr_doc_manager
```
>参数n

namespace，既需要建立索引的collection

>参数t

target-url，这个例子中可以看到这个参数值有两个部分组成前面是`http://127.0.0.1:8983/solr`既`Solr`的服务地址，后面的`test`表示我们的索引都保存到`test`这个`Core`中

>参数a

admin-username，`MongoDB`的`admin`用户

## 测试

首先我们在`MongoDB`中插入数据

```
db.getCollection("test").insert({
    "content": "我在这里想测试一下同步功能"
})
```

然后可以直接通过浏览器向`Solr`查询数据，比如我们查询content中包含‘测试’的数据，下面的例子我使用的是`curl`工具

```shell
curl http://127.0.0.1:8983/solr/test/select\?q\=content:%22%E6%B5%8B%E8%AF%95%22
{
  "responseHeader":{
    "status":0,
    "QTime":1,
    "params":{
      "q":"content:\"测试\""}},
  "response":{"numFound":1,"start":0,"docs":[
      {
        "content":["我在这里想测试一下同步功能"],
        "_id":"5d5c9a5d783847b9ac1def94",
        "_version_":1642379054674870272}]
}}
```



