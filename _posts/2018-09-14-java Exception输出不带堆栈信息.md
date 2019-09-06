最近在看服务的error日志的时候发现了一个问题，有很多`NullPointerException`只有`Exception`名却没有`stack trace`的信息导致不容易定位问题点。

## 解决
考虑到在程序中所有的`Exception`都是通过`slf4j`的`log.error(e)`的方式输出的，不应该存在多数`Exception`有输出`stack trace`部分`Exception`没有的情况。问题就可能出在`slf4j`或者`jvm`，通过搜索以后在`stackoverflow`上发现了有相同的问题[NullPointerException in Java with no StackTrace](https://stackoverflow.com/questions/2411487/nullpointerexception-in-java-with-no-stacktrace)里面提及这是因为`java`虚拟机优化的影响。具体的说明见`oracle`的说明[java release note](http://www.oracle.com/technetwork/java/javase/relnotes-139183.html#vm)，里面是这样描述的

***The compiler in the server VM now provides correct stack backtraces for all "cold" built-in exceptions. For performance purposes, when such an exception is thrown a few times, the method may be recompiled. After recompilation, the compiler may choose a faster tactic using preallocated exceptions that do not provide a stack trace. To disable completely the use of preallocated exceptions, use this new flag: -XX:-OmitStackTraceInFastThrow.***

根据描述通过添加`jvm`参数`-XX:-OmitStackTraceInFastThrow`可以禁用。

## 写在最后
为了能重现现象我写了个简单的死循环，在循环了10000多次以后才重现了该现象。不得不吐槽`a few`未免也太`few`了点

```java
public static void main(String[] args){
        int i= 0;
        while (true) {
            System.out.println(i++);
            try {
                String a = null;
                if (a.equals("a")) {
                    int b = 1;
                }
            } catch (Exception e) {
                e.printStackTrace(System.out);
            }
        }
    }
```