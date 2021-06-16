本文主要讲解`Mysql InnoDB Storage Engine`中的锁

## Shared and Exclusive Locks

`InnoDB`中有两种行级别的锁`shared (S) locks`（共享锁）和`xclusive (X) locks`（互斥锁）

* 共享锁允许持有锁的事务查询数据行
* 互斥锁允许持有锁的事务更新或者删除数据行
  
如果事务`T1`持有了行号为`r`的共享锁，那么另外的事务`T2`对于行`r`的请求处理如下：

* `T2`如果请求共享锁会立即生效。也就是说`T2`和`T1`同时持有对行`r`的共享锁
* `T2`如果请求互斥锁不会立即生效
  
如果事务`T1`持有了行号为`r`的互斥锁，那么另外的事务`T2`对于行`r`任何的锁请求都不会立即生效，而是等待`T1`释放对于`r`的锁

### Intention Locks

`InnoDB`支持`multiple granularity locking(MGL)`（多粒度锁），允许行锁和表锁共存。`InnoDB`使用`intention locks`（意向锁）实现`MGL`，意向锁是表级别的锁，用来表示接下来事务对表中某一行请求的锁类型。意向锁分两种：
* `intention shared lock (IS)`(意向共享锁)表示事务打算对表中的各个行加共享锁
* `intention exclusive lock (IX)`(意向互斥锁)表示事务打算对表中的各个行加互斥锁

意向锁规则：
* 在事务获取表中某行的共享锁之前，事务必须先获取表的`IS`锁或者`IX`锁
* 在事务获取表中某行的互斥锁之前，事务必须先获取表的`IX`锁

表级锁的兼容性如下所示

|     | X        | IX         | S          | IS         |
| --- | -------- | ---------- | ---------- | ---------- |
| X   | Conflict | Conflict   | Conflict   | Conflict   |
| IX  | Conflict | Compatible | Conflict   | Compatible |
| S   | Conflict | Conflict   | Compatible | Compatible |
| IS  | Conflict | Compatible | Compatible | Compatible |

> 比如`LOCK TABLES ... WRITE`是互斥锁，`SELECT ... LOCK IN SHARE MODE`是意向共享锁，`SELECT ... FOR UPDATE`是意向互斥锁

### Record Locks

记录锁是作用在索引上的锁，比如`SELECT c1 FROM t WHERE c1 = 10 FOR UPDATE;`会阻止其他事务对于`t.c1=10`的数据行的插入，修改和删除。因为记录锁只会对索引起作用，所以当一张表没有定义索引时`innodb`会创建一个隐藏的`clustered index`这样记录锁就能作用在上面了

下面一个例子中事务一使用了`IS`锁而事务二需要对`id=1`的数据进行修改，这时由于发送了锁竞争会导致事务二中的`update`语句无法执行

<table>
  <tr>
    <th>Transaction 1</th>
    <th>Transaction 2</th>
  </tr>
  <tr>
    <td>
      <pre>mysql> start transaction;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from users where id = 1 lock in share mode;
+----+------+------+
| id | name | age  |
+----+------+------+
|  1 | tom  |   21 |
+----+------+------+
1 row in set (0.01 sec)</pre>
    </td>
    <td>
    </td>
  </tr>
  <tr>
    <td>
    </td>
    <td>
      <pre>mysql> start transaction;
Query OK, 0 rows affected (0.00 sec)

mysql> update users set name = '111' where id = 1;
ERROR 1205 (HY000): Lock wait timeout exceeded; try restarting transaction</pre>
    </td>
  </tr>
</table>

用`SHOW ENGINE INNODB STATUS`能看到锁的信息

```shell
---TRANSACTION 1980, ACTIVE 8 sec starting index read
mysql tables in use 1, locked 1
LOCK WAIT 2 lock struct(s), heap size 1136, 1 row lock(s)
MySQL thread id 33, OS thread handle 140680312268544, query id 672 172.17.0.1 root updating
update users set name = '111' where id = 1
------- TRX HAS BEEN WAITING 8 SEC FOR THIS LOCK TO BE GRANTED:
RECORD LOCKS space id 31 page no 3 n bits 72 index PRIMARY of table `test`.`users` trx id 1980 lock_mode X locks rec but not gap waiting
Record lock, heap no 2 PHYSICAL RECORD: n_fields 5; compact format; info bits 0
 0: len 8; hex 0000000000000001; asc         ;;
 1: len 6; hex 000000000721; asc      !;;
 2: len 7; hex 3b00000130036d; asc ;   0 m;;
 3: len 3; hex 746f6d; asc tom;;
 4: len 4; hex 80000015; asc     ;;
```

### Gap Locks

间隙锁用来锁定索引记录中一段间隔用的，比如`SELECT c1 FROM t WHERE c1 BETWEEN 10 and 20 FOR UPDATE;`将会阻止其他事务向数据列`t.c1`插入数据值为`15`的记录。当使在语句中使用唯一索引作为条件查询唯一行的时候，不会使用间隙索引，比如语句`SELECT * FROM child WHERE id = 100;`当数据列`id`有唯一索引时就不会触发间隙锁

在`mysql`的文档中间隙锁被形容为`purely inhibitive`，唯一的作用是阻止其他事务在间隙中插入数据。间隙锁是可以共存的，一个事务只有的间隙锁不会阻止其他事务相同区间的间隙锁。共享或者互斥的间隙锁没有区别，不互相冲突

当将事务隔离级别设置为`READ COMMITTED`间隙锁就会被禁用，这种情况下间隙锁只会用于外键约束检查和重复键检查

### Next-Key Locks

临键锁是记录锁和间隙锁的集合，用来锁定索引记录和索引记录之前的一段区间

InnoDB行级锁的执行方式，是搜索或扫描索引时，会在遇到的索引记录上设置共享锁或互斥锁。因此，行级锁本质上是索引记录锁。索引记录上的临键锁也会影响该索引记录之前的区间。即：临键锁=记录锁+间隙锁

假定一个索引包含10、11、13和20这4个值，此时该索引的临键锁可以包括这些：

```
(negative infinity, 10]
(10, 11]
(11, 13]
(13, 20]
(20, positive infinity)
```

最后一组区间，临键锁锁定的区间是从大于索引中的最大值开始一直到`supremum`（比索引中任何值都大虚拟记录）。 `supremum`并不不是真正的索引记录，所以这个临键锁仅锁定当前最大索引值之后的间隙

在`Innodb`中使用`REPEATABLE READ`作为默认隔离级别，在这种隔离级别下，`InnoDB`使用临键锁来进行搜索和索引扫描，防止幻影行

### Insert Intention Locks

插入意向锁是在插入新行之前，由`INSERT`操作设置的一种间隙锁，这个锁表明插入的意图信号，执行方式为：如果多个事务想在同一间隙中插入记录，只要不在同一个位置，则不需要阻塞或等待。

下面的例子中客户端A创建了包含两个索引记录（90、102）的表`child`，然后新开一个事务在`ID>100`的索引记录上加了一个互斥锁，该锁也包含了记录102之前的一段间隙锁

```
mysql> CREATE TABLE child (id int(11) NOT NULL, PRIMARY KEY(id)) ENGINE=InnoDB;
mysql> INSERT INTO child (id) values (90),(102);

mysql> START TRANSACTION;
mysql> SELECT * FROM child WHERE id > 100 FOR UPDATE;
+-----+
| id  |
+-----+
| 102 |
+-----+
```

然后客户端B新开一个事务并插入一条数据，该事务在等待获得排他锁时，会先获取插入意向锁

```
mysql> START TRANSACTION;
mysql> INSERT INTO child (id) VALUES (101);
```

客户端B的事务信息显示如下

```
---TRANSACTION 2055, ACTIVE 6 sec inserting
mysql tables in use 1, locked 1
LOCK WAIT 2 lock struct(s), heap size 1136, 1 row lock(s)
MySQL thread id 41, OS thread handle 140680311998208, query id 1055 172.17.0.1 root update
INSERT INTO child (id) VALUES (101)
------- TRX HAS BEEN WAITING 6 SEC FOR THIS LOCK TO BE GRANTED:
RECORD LOCKS space id 32 page no 3 n bits 72 index PRIMARY of table `test`.`child` trx id 2055 lock_mode X locks gap before rec insert intention waiting
Record lock, heap no 3 PHYSICAL RECORD: n_fields 3; compact format; info bits 0
 0: len 4; hex 80000066; asc    f;;
 1: len 6; hex 000000000801; asc       ;;
 2: len 7; hex bb00000131011c; asc     1  ;;
```

### AUTO-INC Locks

自增锁是一种特殊的表级锁，当事务需要向具有`AUTO_INCREMENT`列的表插入数据时获取。举个简单例子，如果一个事务正往表中插入值，那么其他事务必须等待他完成之后才能往该表中插入新值，这样插入的数据行会有连续的自增主键值

### Predicate Locks for Spatial Indexes

`InnoDB`支持地理空间列的`SPATIAL`索引

对`SPATIAL`索引记录上锁时，临键锁并不能很好地支持`REPEATABLE READ`或`SERIALIZABLE`事务隔离级别。因为多维数据中没有绝对的顺序概念，因此无法判定谁是“下一个“键值

为了在事务隔离级别中支持具有`SPATIAL`索引的表，`InnoDB`使用了`Predicate Lock`(谓词锁)。
`SPATIAL`索引记录包含MBR值(minimum bounding rectangle-最小边界矩形)，因此`InnoDB`在匹配MBR值的索引记录上设置谓词锁，来实现对索引强制执行一致性读。其他事务不能插入或修改匹配查询条件的行