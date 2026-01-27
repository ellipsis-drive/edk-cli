FROM ghcr.io/ellipsis-drive/python

COPY --chown=ellipsis:ellipsis requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=ellipsis:ellipsis . ./

ENTRYPOINT ["python3", "socketConnection.py", "v3"]