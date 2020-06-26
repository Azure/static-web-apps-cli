
### Auth flow
```
https://githubadge.staticweb.app/.auth/login/github?post_login_redirect_uri=/profile
    Request Method: GET
    Response:
        location: https://identity.azurestaticapps.net/.redirect/github?hostName=githubadge.staticweb.app&staticWebAppsAuthNonce=SnrnxEksxVI7vbxy8A0LbmCZfG09Tbz6l9x3nXPkVPdb5rqh53gdnKAdfsZSO5i9VIufGwT5a8q%2fQ%2bO1AQ2931eGRZgY9rVM1Y07hFttbsobXlYYKHugt2DO3r43MdFb
        set-cookie: StaticWebAppsAuthContextCookie=hemQRxmGYK0B74M8D6Pujb9rY/b7xl7teTLww03jTY9BBXH1ncTxCw/suP/+E0fZ3zpenmdK7BccFIG3wtvMxtkygUm+w+00/Lm+SeySsUSd9NE1ZyOwr5YUD/eXHqF45AHCW0dpG336ZIV3kgE7Nyaet9FGVN0yX0QNfRuWzMv5mU0SIU1ReT5+3ZOtGLsu0pDerF+ghDXZFA04KNp1Hcmqx694/ojc3cZsrxgCLiJY9zdAl05fKDChyUy5Qvx2417GYl53/L2d5IFQhrgsXPg6XvAZauihn02r+7EbV3/eJ41RBBDBRLqcR1jth8btLpE6dMDMxiT5zGFs99btTnQRGZZW3P5LkOkE57A2Kjf0ukzfetTipjkHiupvidZouzIRQy2JIMt2ZwWxdDiHMg==; path=/; secure; HttpOnly; domain=githubadge.staticweb.app; SameSite=None
        status: 302
```

```
https://identity.azurestaticapps.net/.redirect/github?hostName=githubadge.staticweb.app&staticWebAppsAuthNonce=SnrnxEksxVI7vbxy8A0LbmCZfG09Tbz6l9x3nXPkVPdb5rqh53gdnKAdfsZSO5i9VIufGwT5a8q%2fQ%2bO1AQ2931eGRZgY9rVM1Y07hFttbsobXlYYKHugt2DO3r43MdFb
    Request Method: GET
    Response:
        location: https://identity.azurestaticapps.net/.auth/login/github?post_login_redirect_uri=/.auth/login/done
        set-cookie: StaticWebAppsAuthContextCookie=5bcO2bxY9Rxp1WITSJwYST4ok1f1wk06AZXsMmyt+pxh9W/jeFusuPbL3tdOEjVBjCVn0b8G7QJBLs9/yI4Vcu0I4egMkT2UmPww/dUOjJWPxSrAXtKgISvB4qQeV7XlJZEy2w7HI0onaoShKhHAkMEKMhhOK+ixiNI3LNvWA4WZsFudtBx/T6M4BfiakfOEAm1zyYgd5kv3u7YXgtLM//bMhBNJdN0PRdbDr3wPIvPRV9pWBlXscoN9qvdx2EhLDxV7ySZ80FBBEv3ON0fJ7ftajVh87MEW1as65iAgVSF+g7FcGpOiv2ccpRUMrDUZj81woMEwytlNpzFAze+yWhaJXSIQrI2YvVxAIyZ+kM2Idus2ENrX/z2sSkQ5F943mA8M0kMxo3SUf7ip3wWQP9eYmBogJ5VdghKRBz4++nE=; path=/; secure; HttpOnly; domain=identity.azurestaticapps.net; SameSite=None
        status: 302
```

```
https://identity.azurestaticapps.net/.auth/login/github?post_login_redirect_uri=/.auth/login/done
    Request Method: GET
    Response:
        location: https://github.com/login/oauth/authorize?client_id=1ef002a10ef0cd153519&redirect_uri=https%3A%2F%2Fidentity.azurestaticapps.net%2F.auth%2Flogin%2Fgithub%2Fcallback&state=redir%3D%252F.auth%252Flogin%252Fdone%26nonce%3D9c847c24795643318ed848489f277c41_20200622184328
        set-cookie: Nonce=tlkcm+h/6xgJ9DmWwT0QeEg+/VKGznOjxfYuG0O5FP/uBoByAky53brEOpMQE75WxcsKyT7yHSSCfQvBcRTgc02U/KKwE0VLgW3efY6YfT5bXPZVmE3k1cEqJx38Bnw2; path=/; secure; HttpOnly; SameSite=None
        status: 302
```

```
https://github.com/login/oauth/authorize?client_id=1ef002a10ef0cd153519&redirect_uri=https%3A%2F%2Fidentity.azurestaticapps.net%2F.auth%2Flogin%2Fgithub%2Fcallback&state=redir%3D%252F.auth%252Flogin%252Fdone%26nonce%3D9c847c24795643318ed848489f277c41_20200622184328
    Request Method: GET
    Response:
        Set-Cookie: user_session=5g-ilhiWEr2210wqHgrzPVMFuqVKyuHo5QQabqBDP3hV94zu; path=/; expires=Mon, 06 Jul 2020 18:38:29 GMT; secure; HttpOnly; SameSite=Lax
        Set-Cookie: __Host-user_session_same_site=5g-ilhiWEr2210wqHgrzPVMFuqVKyuHo5QQabqBDP3hV94zu; path=/; expires=Mon, 06 Jul 2020 18:38:29 GMT; secure; HttpOnly; SameSite=Strict
        Set-Cookie: has_recent_activity=1; path=/; expires=Mon, 22 Jun 2020 19:38:29 GMT; secure; HttpOnly; SameSite=Lax
        Set-Cookie: _gh_sess=wT3ilPrtVdw7TShLKDSCDNmdnTnUKaWAksYsdhqQ6mOyDbJAt44YUXz0Ou%2FXe9s6FekK0Grn9yWGmqFtuAAs%2BsbwT1Zks3LrgXCvIFFcCQwL18LOoSyr5l4FtvZO79xvMI5pnt0TH%2FB%2BDXH3sQTi0w7Hhz8nuo4Mq2fkrZGgzX5AYdqk5izetqW%2B4DNc6xipYzJQRjqb7g8REhl62eQSkD%2BBCOFYYett%2F%2BGbTbdPtV0%2Ffx4Sc97gqCsagBCgX9sCM284c6bMKkJy8jWF%2BtYlZGavnfMS%2F2b8mWVKxs2OaIih2W8iOWnDVQWrjj7MLsDG%2BSxTTS1rCQdCbDl1d0AsCedJMiH9zkyvup%2BK82rsS7tIwTVohjfpH1UE%2Bp57SLzDjCmLCMo0fP6XL7z4uRDLO92ZBsa8p7gVpRErmwmkEjVOkP8%2F3jRSCRKgo3L%2FSc5hDmMc73KrT773nO1GjLw2Lv4DjjNp2qWMBiFOKv0ofsYT45CwVFqI0gQrf24NlqejustKG%2BghMGWANTuT0lPvRjR5RHmSWe9MqMvMXeOn6zYrnmEgdecEa4pUsWiw6ztvtmAA%2FEiIVsI9XXePwV%2FM29Q29AniVfc3o2BzRPHKrLw9SRVm3mw8x9xO5VlP3KKOe1VMMkSiidcHvxBAACH%2BM2vonPDMZZnri7ibQwqe43XzSqPMIvBT8IqOmxnFr6gOBQ%2FwKb2Iznbmw1h8nFDBrjoRjZk%2BCqZi1Jno%2BtzqX7ZQl6S%2FRiEtyXlcehdrrIkFartjG4uznbL6KUdECBXLvlSpLz7bzausD0HGA%2FBQGFHaGHxJJHudqepjCSmfLaxGRnfA7RIax7yQ%2BOV%2FMaAPFac91gA8tnmNsFcgr0aSH2z0HQ9c%2BVST0UE9q18M4yERjVdp2nsPm7TRRZe0yO1lZRWy9Okyt6EWHv4uLw6865yhsoqoeUV%2F3P1Wici6Gt%2BV8w8vOq45fjLRLkiUofYcoyHMEl4QNIXbIP0w%2FyzLx4nlzjHhGdNzO2%2FpZ37MhbIj4K4DLyANahvVfYx2%2BWB5jPffN4mkegGIU1oRbvE63Z3QWkAjTi45vI9fLF7nk%2F0Ta6W5W4KKr2J6ml%2BHyQ05QiGuj9HeCLFwcmFDdfqNrj8OVgV%2F4zWo%2FjzkZDeM4hpeCiHOsTANN377gDFxksQNp0l07MaINaLFe21vW1oBwvJzWRZJH2Cc%2BrGTQmEkv9FGREa8xr%2FB9niyJTTsAEK7F4f82qtcRP%2B1xIF2A3BYdIwK6U1ZJ110HTDhkCPpxaRzv0l3ZYyN5FbDOvHm2Fzq4j6zoCpGzSQrHZDnVuVg3f9vi0BXwTfZVQkhVnlL15baxEd9xX0KbqhU7%2FnWzSSvwZHDyLlvzyd1YjOzurGgd3GzvNsPR%2F0hMs35gzuIyyxtwjJ0EPFfCj4AQbVwvOe94GSFtApvCDS2gYQ9FH%2BzbSSunqZVDzDsjHDaGBTtjvzcyoaxlUwoaTwE37sSwk0YDOAsrIlZ7H6QLHm%2Ft0eijkpr4GX6igmdbNFmM6DNZjYEc4XVkPxA5AdSg3dWouK2a4lXd1ITGXpRVQLbGTv%2FkOuWWtJO3If0dVYkYMVYYQiPJjuylys5daFd6Xztv%2FLVzSQLo9qBiNGWZdqZW97cQXykL4%2BFDuCgoSlXyAxXYkaYaC2oZhYVEYSTHgdAGgc%2BVZmTdFgOOG2x4%2Feu1mR4Q6pArsGCsTuddTkJdJTiW96sM6kjFUdCOBigQ7SQpYqgQA%3D%3D--VrEQQNDVq3KmtD3u--ih34VeN1T3H0YMw%2FhLCA0Q%3D%3D; path=/; secure; HttpOnly; SameSite=Lax
        Status: 302 Found
```

```
https://identity.azurestaticapps.net/.auth/login/github/callback?code=47dceff4feccb4bfb2ab&state=redir%3D%252F.auth%252Flogin%252Fdone%26nonce%3D9c847c24795643318ed848489f277c41_20200622184328
    Request Method: GET
    Response:
        location: https://identity.azurestaticapps.net/.auth/login/done
        set-cookie: Nonce=deleted; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT
        set-cookie: RedirectCount=deleted; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT
        set-cookie: AppServiceAuthSession=YX7WHtdtbASMcCi94gqCT8naNuu75Y4Wll6ANJye8L26WWMcf3gq7+1SDa7v43vHWFC/gi4tBMwl7q2nW1GSz8pOfl6mDoAXa6KnIz12EWi1j5/Sjl29LbSMYiPEPImuiyApNrg8aHi4aLIxdtFpu5v9aZIpYmK9xSiY0ZDStfYgQvkDl82QSBADO+RVlIza2cglluPMGvCxbWPcwp/s9gQ7vzDzJxoxCSamlvNF8HLLhJH/W8+E6sExCz1d8N0oqhw9QH09i9KGbwJusMWsV0LOiZ6baj+I1nYdCkKu4YWIiajRl+M++JNgRvzmojaurzhLqP2fwWlkdChDA44ZJLrn/6QtjYs2r1HlSpD3IkLW3KM4AK9+u+sXSnrQLbGXNvcSVYByisXXpLOIIeSoqZDLtZf5sKhG3nwjvA3P+PNREpYPfEp6p7DrhklNyxoHjMjGCY9Qwz5l1HHPky4V9r/UwQGjdYBa0SVMQLZolgnRqj6rnueds5Vd0zxKt9a0XiSVdJ7fpB0sCMIKXpk2ioSnNpG4KULo97lMqhDum2bWb89uXOm9qNZp6yahix9Ao/KKeT9bL7NVDhEeRozcmcaKF0FeioHiEajkLbv6bbJzt7mIfSbi6K4aKM0T9U66Gdojf3ET06BqhoQnEXMqYs5IfDK+tNM7TjTbyzUH+X5qSeAso9vBCTYveT0r1iTzqzzd8TgM7kTav//7maQyvQWvjaT4lAwm0G3yIh3F+XRz/cOxu/TQnOhrOB/7yhbdnO3BlfiQkgAbIycxRVN9cLcLqiSLe2YkIga1ABY7lgZyZ4JhiTiK56NI+pKgaX5LP2Px2gEKty/J6ag8CAb3DE1Uy+VRH0ql2qGNCvBX3fjzgGsS7UEmUo8+1Zh1LeZ+72K0PvQgY3HLS3w0nOIPqMJ8kX3cz43CaT7nvwh6h3ZVaWUvJicSF0hV377dPDCJ4bCP1RV4J/KED92p4LdPAZGB5Rxm5Eb8mORMiXq+24pRiYWPZHbVtWnTcVZubQZW; path=/; secure; HttpOnly; SameSite=None
        status: 302
```

```
https://identity.azurestaticapps.net/.auth/login/done
    Request Method: GET
    Response:
        set-cookie: StaticWebAppsAuthContextCookie=deleted; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=identity.azurestaticapps.net
        status: 200
```

```
https://githubadge.staticweb.app/.auth/complete
    Request Method: POST
        user_login_jwt: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IlNucm54RWtzeFZJN3ZieHk4QTBMYm1DWmZHMDlUYno2bDl4M25YUGtWUGRiNXJxaDUzZ2RuS0FkZnNaU081aTlWSXVmR3dUNWE4cS9RK08xQVEyOTMxZUdSWmdZOXJWTTFZMDdoRnR0YnNvYlhsWVlLSHVndDJETzNyNDNNZEZiIiwiaWRlbnRpdHlwcm92aWRlciI6ImdpdGh1YiIsInVzZXJpZGZyb21wcm92aWRlciI6IjE2OTkzNTciLCJ1c2VyaWQiOiI1OWNkMzFmYWE4YzM0OTE5YWMyMmMxOWFmNTA0ODJiOCIsInVzZXJkZXRhaWxzIjoibWFuZWtpbmVra28iLCJpc25ld3VzZXIiOiJGYWxzZSIsImV4aXN0aW5ncm9sZXMiOiIiLCJuYmYiOjE1OTI4NTExMTAsImV4cCI6MTU5Mjg1MTQxMCwiaWF0IjoxNTkyODUxMTEwLCJpc3MiOiJodHRwczovL2lkZW50aXR5LmF6dXJlc3RhdGljYXBwcy5uZXQvIiwiYXVkIjoiaHR0cHM6Ly9pZGVudGl0eS5henVyZXN0YXRpY2FwcHMubmV0LyJ9.YF9OvdJ8_1TyS3It92ZVGNeTb93uo2sEjUfgaQQRcvQ
    Response:
        location: https://githubadge.staticweb.app/profile
        set-cookie: StaticWebAppsAuthContextCookie=deleted; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=githubadge.staticweb.app
        set-cookie: StaticWebAppsAuthCookie=wuQGb66G3Hlp7XDatZ793NvxQn59r5ciITO4Z+RLosA750ZENuv7sryRZJgB7HB6A9e1lzV7nzuzbjrzUZg/893Jti7lfhz5UgBBteHqRlr+kGSwxen/02/kWMFSk+s5KI770cr0XqApiwIikvGv2rIU4et+zophWV74cK1DCms=; path=/; secure; HttpOnly; domain=githubadge.staticweb.app; SameSite=Strict
        status: 302
