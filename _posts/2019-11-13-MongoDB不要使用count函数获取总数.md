最近遇到一个奇怪的问题，在使用`db.collection.aggregate()`统计数量的时候发现总量和`db.collection.count`查询的结果不一样。

```shell
> db.sentiment.aggregate([{$count:"count"}])
{ "count" : 66369 }
> db.sentiment.count()
66161
```

从上面可以看到聚合计算的总数和直接用`count`函数的总数是不一致的。通过GUI工具查看数据发现是`count`函数的结果有问题。翻看`MonogoDB`的[官方文档](https://docs.mongodb.com/manual/reference/method/db.collection.count/#definition)可以发现其中的奥秘。文档中有这么一段话

>IMPORTANT:
>
* Avoid using the [db.collection.count()](https://docs.mongodb.com/manual/reference/method/db.collection.count/#db.collection.count) method without a query predicate since without the query predicate, the method returns results based on the collection’s metadata, which may result in an approximate count. In particular,
	* On a sharded cluster, the resulting count will not correctly filter out [orphaned documents](https://docs.mongodb.com/manual/reference/glossary/#term-orphaned-document).
	* [After an unclean shutdown](https://docs.mongodb.com/manual/reference/method/db.collection.count/#collection-count-accuracy-shutdown), the count may be incorrect.
* For counts based on collection metadata, see also [collStats pipeline stage with the count](https://docs.mongodb.com/manual/reference/operator/aggregation/collStats/#collstat-count) option.

简而言之就是`count`函数取得是`collection`的`metadata`中的数值，这个数据是不能保证正确的，如果想获取正确的值一定要通过查询表数据获得。

所以这里我使用如下查询就可以获取正确的数值：

```shell
> db.sentiment.count({_id:{$exists:true}})
66369
```	