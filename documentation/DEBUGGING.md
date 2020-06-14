
# Looking into the app.asar file
```
npm install -g asar
```

Extract the whole archive:
```
npx asar extract app.asar destfolder 
```

Extract a particular file:
```
npx asar extract-file app.asar main.js
```


# Windows Explorer open .chargy files with Chargy fails

- Chargy registers the file extention ".chargy" and the mime type "application/x-chargy" to be opened with Chargy.
- Check if Chargy will be in the task manager. If yes, it "just" failed before opening its application window.
- Open a command line and start Chargy with a transparency file as command line parameter from a directory different to its application folder. By this you should see error Node JS messages.
